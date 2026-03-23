'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Typography, Box, Button, Alert } from '@mui/material';
import { useRouter } from 'next/navigation';
import AgentBriefing from '@/components/AgentBriefing';
import PlanPreview from '@/components/checkin/PlanPreview';
import { parseScheduleTable } from '@/lib/parse-schedule';
import { getPlanWeekNumber } from '@/lib/week';
import type { PlanItem } from '@/lib/types';
interface SpecialistOutput {
  agentId: string;
  label: string;
  content: string;
  error: string | null;
}

export default function CheckInResultsPage() {
  const router = useRouter();
  const [specialists, setSpecialists] = useState<SpecialistOutput[]>([]);
  const [synthesis, setSynthesis] = useState('');
  const [phase, setPhase] = useState<string>('init');
  const [error, setError] = useState<string | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem('checkin_form_data');
    } catch {
      // sessionStorage may not be available
    }

    if (!raw) {
      setError('No check-in data found. Please start from the check-in form.');
      return;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw);
    } catch {
      setError('Corrupted check-in data. Please restart the check-in.');
      return;
    }

    // Send as-is — the API route detects new vs legacy format
    runCheckIn(payload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runCheckIn(payload: Record<string, unknown>) {
    try {
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        setError(`API error: ${response.status} — ${errorBody}`);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError('No response stream');
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      // Persist eventType across chunks so event:/data: pairs that span chunks work
      let currentEventType = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are delimited by double newlines
        // Process complete events (split on \n\n)
        const events = buffer.split('\n\n');
        buffer = events.pop() || ''; // Keep incomplete event in buffer

        for (const eventBlock of events) {
          if (!eventBlock.trim()) continue;

          const lines = eventBlock.split('\n');
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEventType = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              let data;
              try {
                data = JSON.parse(line.slice(6));
              } catch {
                continue; // Skip malformed data lines
              }

              switch (currentEventType) {
                case 'status':
                  setPhase(data.phase);
                  break;
                case 'specialist':
                  setSpecialists((prev) => [...prev, data]);
                  break;
                case 'synthesis_chunk':
                  setSynthesis((prev) => prev + data.text);
                  break;
                case 'synthesis_complete':
                  setPhase('done');
                  try {
                    sessionStorage.setItem('checkin_synthesis', data.fullText);
                  } catch {
                    // ignore storage errors
                  }
                  // Parse plan items from synthesis output
                  try {
                    const weekNum = getPlanWeekNumber();
                    const parsed = parseScheduleTable(data.fullText || '', weekNum);
                    if (parsed.length > 0) {
                      setPlanItems(parsed);
                    }
                  } catch {
                    // Non-fatal — plan preview simply won't render
                  }
                  break;
                case 'error':
                  setError(data.message);
                  break;
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  const handleLockIn = () => {
    router.push('/plan');
  };

  return (
    <Box>
      <Typography variant="h3" fontWeight={700} sx={{ mb: 4 }}>
        Check-In Results
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
          <Button onClick={() => router.push('/checkin')} sx={{ ml: 2 }}>
            Back to Form
          </Button>
        </Alert>
      )}

      <AgentBriefing
        specialists={specialists}
        synthesis={synthesis}
        completedCount={specialists.length}
        totalCount={7}
        synthesisStreaming={phase === 'synthesis'}
      />

      {phase === 'done' && planItems.length > 0 && (
        <PlanPreview
          items={planItems}
          weekNumber={getPlanWeekNumber()}
          onLockIn={handleLockIn}
        />
      )}

      {phase === 'done' && planItems.length === 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Button
            variant="contained"
            size="large"
            onClick={handleLockIn}
            sx={{ px: 6, py: 1.5, fontSize: '1.1rem' }}
          >
            Lock In
          </Button>
        </Box>
      )}
    </Box>
  );
}
