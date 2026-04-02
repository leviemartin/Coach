'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  TextField,
  Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import type { WeeklyReviewData } from '@/app/api/checkin/review/route';
import type { CheckinSubjectiveData } from '@/lib/types';
import type { TriageAnswer, TriageQuestion } from '@/lib/triage-agent';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TriageQAProps {
  reviewData: WeeklyReviewData | null;
  subjectiveData: CheckinSubjectiveData;
  onComplete: (answers: TriageAnswer[]) => void;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

// ── Routing hint inference ────────────────────────────────────────────────────

const TOPIC_TO_ROUTING: Record<string, TriageAnswer['routing_hint']> = {
  missing_logs: 'compliance',
  injury_pain: 'injury',
  sleep_compliance: 'recovery',
  training_load: 'training',
  nutrition: 'nutrition',
  hydration: 'nutrition',
  energy_pattern: 'recovery',
  protocol_compliance: 'compliance',
  contradiction: 'general',
  other: 'general',
};

function inferRoutingHint(topic: string): TriageAnswer['routing_hint'] {
  return TOPIC_TO_ROUTING[topic] ?? 'general';
}

function isBackfillQuestion(q: TriageQuestion): boolean {
  return q.topic === 'missing_logs';
}

// ── Chat bubble components ────────────────────────────────────────────────────

function AgentBubble({ text }: { text: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
      <Box
        sx={{
          maxWidth: '80%',
          bgcolor: '#f0f0eb',
          border: '1px solid #e4e4e0',
          borderRadius: 0,
          px: 2,
          py: 1.5,
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#71717a', display: 'block', mb: 0.5 }}>
          Triage Agent
        </Typography>
        <Typography variant="body2" sx={{ color: '#18181b', lineHeight: 1.6 }}>
          {text}
        </Typography>
      </Box>
    </Box>
  );
}

function AthleteBubble({ text }: { text: string }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
      <Box
        sx={{
          maxWidth: '80%',
          bgcolor: '#3b82f618',
          border: '1px solid #3b82f640',
          borderRadius: 0,
          px: 2,
          py: 1.5,
        }}
      >
        <Typography variant="body2" sx={{ color: '#2563eb', lineHeight: 1.6 }}>
          {text}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TriageQA({ reviewData, subjectiveData, onComplete }: TriageQAProps) {
  const [loadState, setLoadState] = useState<LoadState>('idle');
  const [questions, setQuestions] = useState<TriageQuestion[]>([]);
  const [answers, setAnswers] = useState<TriageAnswer[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const fetchQuestions = useCallback(async () => {
    if (!reviewData) return;

    setLoadState('loading');
    setErrorMessage('');

    try {
      const res = await fetch('/api/checkin/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewData, subjectiveData }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { questions: TriageQuestion[] };
      setQuestions(data.questions);
      setLoadState('ready');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unknown error');
      setLoadState('error');
    }
  }, [reviewData, subjectiveData]);

  // Auto-fetch on mount
  useEffect(() => {
    if (loadState === 'idle') {
      fetchQuestions();
    }
  }, [loadState, fetchQuestions]);

  // Scroll to bottom when new content appears
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [answers, currentIndex, loadState]);

  const submitAnswer = () => {
    const trimmed = draftAnswer.trim();
    if (!trimmed) return;

    const q = questions[currentIndex];
    const answer: TriageAnswer = {
      topic: q.topic,
      status: 'answered',
      context: trimmed,
      routing_hint: inferRoutingHint(q.topic),
    };

    const updatedAnswers = [...answers, answer];
    setAnswers(updatedAnswers);
    setDraftAnswer('');

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((i) => i + 1);
    }
    // If last question answered, the "Submit to coaches" button becomes visible
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitAnswer();
    }
  };

  const handleSkip = () => {
    // Generate empty answers for all unanswered questions
    const skipped: TriageAnswer[] = questions.map((q, i) => {
      if (i < answers.length) return answers[i];
      return {
        topic: q.topic,
        status: 'skipped',
        context: '',
        routing_hint: inferRoutingHint(q.topic),
      };
    });
    onComplete(skipped);
  };

  const allAnswered = questions.length > 0 && answers.length >= questions.length;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#18181b' }}>
          Pre-flight check
        </Typography>
        <Typography variant="body2" color="text.secondary">
          A few quick questions before the coaching team reviews your week.
        </Typography>
      </Box>

      {/* Loading state */}
      {loadState === 'loading' && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4 }}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            Scanning your week for missing context...
          </Typography>
        </Box>
      )}

      {/* Error state */}
      {loadState === 'error' && (
        <Alert
          severity="error"
          action={
            <Button size="small" onClick={fetchQuestions}>
              Retry
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {errorMessage || 'Failed to generate triage questions.'}
        </Alert>
      )}

      {/* Chat interface */}
      {loadState === 'ready' && (
        <>
          {/* Render answered Q&A pairs */}
          {answers.map((answer, i) => (
            <Box key={questions[i].topic}>
              <AgentBubble text={questions[i].question} />
              <AthleteBubble text={answer.context || '(skipped)'} />
            </Box>
          ))}

          {/* Current question (if not all answered) */}
          {!allAnswered && questions[currentIndex] && (
            <>
              <AgentBubble text={questions[currentIndex].question} />

              {/* Backfill link — shown when question relates to missing/backfill/log */}
              {isBackfillQuestion(questions[currentIndex]) && (
                <Box sx={{ mb: 1.5, pl: 0.5 }}>
                  <Link
                    href="/log"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '0.8125rem', color: '#2563eb' }}
                  >
                    Go to Daily Log →
                  </Link>
                </Box>
              )}

              {/* Progress indicator */}
              <Typography
                variant="caption"
                sx={{ display: 'block', color: '#a1a1aa', mb: 1.5, pl: 0.5 }}
              >
                Question {currentIndex + 1} of {questions.length}
              </Typography>

              {/* Answer input */}
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                <TextField
                  multiline
                  minRows={2}
                  maxRows={5}
                  fullWidth
                  placeholder="Type your answer... (Enter to send, Shift+Enter for newline)"
                  value={draftAnswer}
                  onChange={(e) => setDraftAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 0,
                    },
                  }}
                />
                <Button
                  variant="contained"
                  disableElevation
                  onClick={submitAnswer}
                  disabled={!draftAnswer.trim()}
                  sx={{ minWidth: 44, px: 1.5, py: 1.25, borderRadius: 0 }}
                >
                  <SendIcon fontSize="small" />
                </Button>
              </Box>
            </>
          )}

          {/* All answered — submit button */}
          {allAnswered && (
            <Box
              sx={{
                mt: 3,
                p: 3,
                bgcolor: '#22c55e18',
                border: '1px solid #22c55e40',
                borderRadius: 0,
                textAlign: 'center',
              }}
            >
              <Typography variant="body2" fontWeight={600} sx={{ color: '#15803d', mb: 2 }}>
                All questions answered. Ready to send to the coaching team.
              </Typography>
              <Button
                variant="contained"
                disableElevation
                size="large"
                onClick={() => onComplete(answers)}
                sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
              >
                Submit to coaches
              </Button>
            </Box>
          )}
        </>
      )}

      {/* Skip link — always visible once questions are loaded */}
      {loadState === 'ready' && !allAnswered && (
        <Box sx={{ mt: 2, textAlign: 'right' }}>
          <Button
            variant="text"
            size="small"
            onClick={handleSkip}
            sx={{ color: '#a1a1aa', fontSize: '0.75rem' }}
          >
            Skip triage
          </Button>
        </Box>
      )}

      <div ref={bottomRef} />
    </Box>
  );
}
