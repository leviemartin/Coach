'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Typography, Box, Button, Alert, CircularProgress } from '@mui/material';
import { useRouter } from 'next/navigation';
import AgentBriefing from '@/components/AgentBriefing';
import PlanPreview from '@/components/checkin/PlanPreview';
import HeadCoachDialogue from '@/components/checkin/HeadCoachDialogue';
import { getPlanWeekNumber } from '@/lib/week';
import type { PlanItem, PlanExercise } from '@/lib/types';
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
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [planExercises, setPlanExercises] = useState<Record<number, PlanExercise[]>>({});
  const [showDialogue, setShowDialogue] = useState(false);
  const [planRebuilding, setPlanRebuilding] = useState(false);
  // Compute week number once on client to avoid server/client mismatch (React 418)
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  const startedRef = useRef(false);
  const planFetchedRef = useRef(false);
  const synthesisTextRef = useRef('');

  // Compute week number on client only (avoids hydration mismatch)
  useEffect(() => {
    setWeekNumber(getPlanWeekNumber());
  }, []);

  // Fetch plan when pipeline completes
  useEffect(() => {
    if (phase !== 'done' || planFetchedRef.current) return;
    planFetchedRef.current = true;

    (async () => {
      try {
        const planRes = await fetch('/api/plan');
        if (planRes.ok) {
          const planData = await planRes.json();
          if (planData.items?.length > 0) {
            setPlanItems(planData.items);
            setPlanExercises(planData.exercises || {});
          }
        }
      } catch {
        // Non-fatal — Lock In button still visible without plan preview
      }
    })();
  }, [phase]);

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
      let currentEventType = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

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
                continue;
              }

              switch (currentEventType) {
                case 'status':
                  setPhase(data.phase);
                  if (data.message) setStatusMessage(data.message);
                  break;
                case 'specialist':
                  setSpecialists((prev) => [...prev, data]);
                  break;
                case 'synthesis_chunk':
                  synthesisTextRef.current += data.text;
                  setSynthesis(synthesisTextRef.current);
                  break;
                case 'synthesis_done':
                  // Synthesis text is complete — Discuss button can activate now
                  try {
                    sessionStorage.setItem('checkin_synthesis', data.fullText);
                  } catch {
                    // ignore storage errors
                  }
                  setPhase('synthesis_complete');
                  break;
                case 'synthesis_complete':
                  // Full pipeline done (plan built + data saved)
                  try {
                    sessionStorage.setItem('checkin_synthesis', data.fullText);
                  } catch {
                    // ignore storage errors
                  }
                  setPhase('done');
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

  // synthesis_complete or done — synthesis text is available for discussion
  const synthesisReady = phase === 'synthesis_complete' || phase === 'done';
  // Plan building is happening between synthesis_complete and done
  const planBuilding = phase === 'synthesis_complete' || phase === 'plan_builder';

  const handleLockIn = async () => {
    const wk = weekNumber ?? getPlanWeekNumber();

    try {
      await fetch('/api/plan/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekNumber: wk }),
      });
    } catch {
      // Non-fatal
    }

    router.push('/log');
  };

  const handlePlanUpdate = (items: PlanItem[], exercises: Record<number, PlanExercise[]>) => {
    setPlanItems(items);
    setPlanExercises(exercises);
    setPlanRebuilding(false);
  };

  const handlePlanRebuilding = () => {
    setPlanRebuilding(true);
  };

  const handleDiscuss = () => {
    setShowDialogue(true);
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

      {/* Plan building progress indicator */}
      {planBuilding && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mt: 3, py: 2 }}>
          <CircularProgress size={18} sx={{ color: '#18181b' }} />
          <Typography variant="body2" sx={{ color: '#71717a' }}>
            {statusMessage || 'Building structured plan...'}
          </Typography>
        </Box>
      )}

      {/* Plan preview — shows once plan is built and fetched */}
      {phase === 'done' && planItems.length > 0 && weekNumber != null && (
        <PlanPreview
          items={planItems}
          exercises={planExercises}
          weekNumber={weekNumber}
          onLockIn={handleLockIn}
          onDiscuss={handleDiscuss}
          loading={planRebuilding}
        />
      )}

      {/* Action buttons when synthesis is ready but no plan preview yet */}
      {synthesisReady && (phase !== 'done' || planItems.length === 0) && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, gap: 2 }}>
          <Button
            variant="outlined"
            size="large"
            onClick={handleDiscuss}
            sx={{ px: 4, py: 1.5 }}
          >
            Discuss with Coach
          </Button>
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

      {/* Head Coach dialogue — available once synthesis text exists */}
      {synthesisReady && showDialogue && weekNumber != null && (
        <HeadCoachDialogue
          specialistOutputs={specialists}
          synthesis={synthesis}
          weekNumber={weekNumber}
          onLockIn={handleLockIn}
          onPlanUpdate={handlePlanUpdate}
          onPlanRebuilding={handlePlanRebuilding}
        />
      )}
    </Box>
  );
}
