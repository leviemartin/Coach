'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  IconButton,
  CircularProgress,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import LockIcon from '@mui/icons-material/Lock';
import type { DialogueMessage } from '@/lib/dialogue';
import { parseScheduleTable } from '@/lib/parse-schedule';
import type { PlanItem } from '@/lib/types';

// ── Types ────────────────────────────────────────────────────────────────────

interface SpecialistOutput {
  agentId: string;
  label: string;
  content: string;
  error: string | null;
}

interface HeadCoachDialogueProps {
  specialistOutputs: SpecialistOutput[];
  synthesis: string;
  weekNumber: number;
  onLockIn: () => void;
  onPlanUpdate?: (items: PlanItem[], updatedSynthesis: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function HeadCoachDialogue({
  specialistOutputs,
  synthesis,
  weekNumber,
  onLockIn,
  onPlanUpdate,
}: HeadCoachDialogueProps) {
  const [messages, setMessages] = useState<DialogueMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  // Track the evolving draft plan — starts as original synthesis, updates when coach modifies it
  const [currentDraftPlan, setCurrentDraftPlan] = useState(synthesis);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change or streaming text updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    const userMessage: DialogueMessage = { role: 'user', content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setStreaming(true);
    setStreamingText('');

    try {
      const response = await fetch('/api/checkin/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          conversationHistory: messages,
          specialistOutputs: specialistOutputs.map((s) => ({
            agentId: s.agentId,
            label: s.label,
            content: s.content,
            model: '',
            error: s.error ?? undefined,
          })),
          sharedContext: '',
          draftPlan: currentDraftPlan,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${response.status} — ${errText}` },
        ]);
        setStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEventType = '';
      let fullCoachText = '';

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
                case 'dialogue_chunk':
                  fullCoachText += data.text;
                  setStreamingText(fullCoachText);
                  break;
                case 'dialogue_complete': {
                  const coachText: string = data.fullText;
                  setMessages((prev) => [
                    ...prev,
                    { role: 'assistant', content: coachText },
                  ]);
                  setStreamingText('');
                  setStreaming(false);

                  // Detect if the coach included an updated schedule table
                  const parsed = parseScheduleTable(coachText, weekNumber);
                  if (parsed.length > 0 && onPlanUpdate) {
                    setCurrentDraftPlan(coachText);
                    onPlanUpdate(parsed, coachText);
                  }
                  break;
                }
                case 'error':
                  setMessages((prev) => [
                    ...prev,
                    { role: 'assistant', content: `Error: ${data.message}` },
                  ]);
                  setStreamingText('');
                  setStreaming(false);
                  break;
              }
            }
          }
        }
      }

      // If stream ended without dialogue_complete, commit whatever we have
      if (fullCoachText) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: fullCoachText },
        ]);
        setStreamingText('');
        setStreaming(false);

        // Check for plan updates in fallback path too
        const parsed = parseScheduleTable(fullCoachText, weekNumber);
        if (parsed.length > 0 && onPlanUpdate) {
          setCurrentDraftPlan(fullCoachText);
          onPlanUpdate(parsed, fullCoachText);
        }
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Connection error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
      ]);
      setStreamingText('');
      setStreaming(false);
    }
  }, [input, streaming, messages, specialistOutputs, currentDraftPlan, weekNumber, onPlanUpdate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      {/* Section header */}
      <Typography
        variant="h5"
        sx={{ fontWeight: 700, mb: 2, letterSpacing: '-0.025em' }}
      >
        Discuss with Head Coach
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: '#71717a', mb: 3 }}
      >
        Challenge the plan, ask why, request changes. The Head Coach will explain
        trade-offs and adjust within safety bounds.
      </Typography>

      {/* Chat messages */}
      <Paper
        variant="outlined"
        sx={{
          maxHeight: 480,
          overflowY: 'auto',
          p: 2,
          mb: 2,
          borderRadius: 0,
          borderColor: '#e4e4e0',
          bgcolor: '#ffffff',
        }}
      >
        {messages.length === 0 && !streaming && (
          <Typography
            variant="body2"
            sx={{ color: '#a1a1aa', textAlign: 'center', py: 4 }}
          >
            Ask the Head Coach about your Week {weekNumber} plan.
          </Typography>
        )}

        {messages.map((msg, idx) => (
          <Box
            key={idx}
            sx={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              mb: 2,
            }}
          >
            <Box
              sx={{
                maxWidth: '80%',
                px: 2,
                py: 1.5,
                borderRadius: 0,
                bgcolor: msg.role === 'user' ? '#18181b' : '#fafaf7',
                color: msg.role === 'user' ? '#fafaf7' : '#18181b',
                border: msg.role === 'user' ? 'none' : '1px solid #e4e4e0',
              }}
            >
              {msg.role === 'assistant' && (
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    fontWeight: 700,
                    color: '#71717a',
                    mb: 0.5,
                    fontSize: '0.6875rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Head Coach
                </Typography>
              )}
              <Typography
                variant="body2"
                sx={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                  '& strong': { fontWeight: 700 },
                }}
              >
                {msg.content}
              </Typography>
            </Box>
          </Box>
        ))}

        {/* Streaming message */}
        {streaming && streamingText && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Box
              sx={{
                maxWidth: '80%',
                px: 2,
                py: 1.5,
                borderRadius: 0,
                bgcolor: '#fafaf7',
                border: '1px solid #e4e4e0',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  fontWeight: 700,
                  color: '#71717a',
                  mb: 0.5,
                  fontSize: '0.6875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                Head Coach
              </Typography>
              <Typography
                variant="body2"
                sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
              >
                {streamingText}
              </Typography>
            </Box>
          </Box>
        )}

        {/* Streaming indicator (before any text arrives) */}
        {streaming && !streamingText && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: 0,
                bgcolor: '#fafaf7',
                border: '1px solid #e4e4e0',
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <CircularProgress size={14} sx={{ color: '#18181b' }} />
              <Typography variant="body2" sx={{ color: '#a1a1aa' }}>
                Coach is thinking...
              </Typography>
            </Box>
          </Box>
        )}

        <div ref={messagesEndRef} />
      </Paper>

      {/* Input area */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', mb: 3 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          multiline
          maxRows={3}
          placeholder="Ask about the plan, request changes..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={streaming}
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 0,
              '&.Mui-focused fieldset': { borderColor: '#18181b' },
            },
          }}
        />
        <IconButton
          onClick={sendMessage}
          disabled={streaming || !input.trim()}
          sx={{
            bgcolor: '#18181b',
            color: '#fafaf7',
            borderRadius: 0,
            width: 40,
            height: 40,
            '&:hover': { bgcolor: '#3f3f46' },
            '&.Mui-disabled': { bgcolor: '#e4e4e0', color: '#a1a1aa' },
          }}
        >
          <SendIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Lock In button */}
      <Box sx={{ textAlign: 'center' }}>
        <Button
          variant="contained"
          size="large"
          onClick={onLockIn}
          startIcon={<LockIcon />}
          sx={{
            bgcolor: '#22c55e',
            color: '#ffffff',
            px: 4,
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 700,
            '&:hover': { bgcolor: '#16a34a' },
          }}
        >
          Lock In Plan
        </Button>
      </Box>
    </Box>
  );
}
