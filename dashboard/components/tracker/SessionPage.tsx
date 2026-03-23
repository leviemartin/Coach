'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Typography, CircularProgress, Alert, Container, IconButton, Tooltip } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type { SessionSetState, SessionCardioState, ParsedExercise } from '@/lib/types';
import SessionProgress from './SessionProgress';
import ExerciseList from './ExerciseList';
import StrengthExercise from './StrengthExercise';
import SupersetBlock from './SupersetBlock';
import CardioIntervals from './CardioIntervals';
import CardioSteady from './CardioSteady';
import SessionComplete from './SessionComplete';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionData {
  sessionId: number | null;
  sessionTitle: string;
  sessionType: string;
  exercises: ParsedExercise[];
  sets: SessionSetState[];
  cardio: SessionCardioState[];
  coachCues: string | null;
  workoutDescription: string | null;
  resumed: boolean;
}

interface CompleteResult {
  compliancePct: number | null;
  weightChanges: Array<{ exercise: string; set: number; from: number | null; to: number | null }>;
  ceilingCheck: string | null;
}

// An exercise block is either a single exercise or a superset group
type ExerciseBlock =
  | { kind: 'single'; exercise: ParsedExercise }
  | { kind: 'superset'; groupId: number; exercises: ParsedExercise[] };

// ── Helper: group exercises into blocks ───────────────────────────────────────

function groupExercises(exercises: ParsedExercise[]): ExerciseBlock[] {
  const blocks: ExerciseBlock[] = [];
  const seenGroups = new Set<number>();

  for (const ex of exercises) {
    if (ex.supersetGroup == null) {
      blocks.push({ kind: 'single', exercise: ex });
    } else {
      if (!seenGroups.has(ex.supersetGroup)) {
        seenGroups.add(ex.supersetGroup);
        const grouped = exercises.filter((e) => e.supersetGroup === ex.supersetGroup);
        blocks.push({ kind: 'superset', groupId: ex.supersetGroup, exercises: grouped });
      }
    }
  }

  return blocks;
}

// ── Helper: display name for a block ──────────────────────────────────────────

function blockDisplayName(block: ExerciseBlock): string {
  if (block.kind === 'single') return block.exercise.name;
  return block.exercises.map((e) => e.name).join(' + ');
}

// ── Helper: sets/cardio completion counts per block ───────────────────────────

function blockCompletion(
  block: ExerciseBlock,
  sets: SessionSetState[],
  cardio: SessionCardioState[],
): { setsCompleted: number; setsTotal: number; completed: boolean } {
  if (block.kind === 'single') {
    const ex = block.exercise;
    if (ex.type === 'cardio_intervals' || ex.type === 'cardio_steady') {
      const c = cardio.find((c) => c.exerciseName === ex.canonicalName);
      return {
        setsCompleted: c?.completedRounds ?? 0,
        setsTotal: c?.prescribedRounds ?? 1,
        completed: c?.completed ?? false,
      };
    }
    const exSets = sets.filter((s) => s.exerciseName === ex.canonicalName);
    const done = exSets.filter((s) => s.completed).length;
    return {
      setsCompleted: done,
      setsTotal: exSets.length,
      completed: exSets.length > 0 && done === exSets.length,
    };
  }

  // Superset: all exercises in group must be complete
  let totalSets = 0;
  let doneSets = 0;
  for (const ex of block.exercises) {
    const exSets = sets.filter((s) => s.exerciseName === ex.canonicalName);
    doneSets += exSets.filter((s) => s.completed).length;
    totalSets += exSets.length;
  }
  return {
    setsCompleted: doneSets,
    setsTotal: totalSets,
    completed: totalSets > 0 && doneSets === totalSets,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [completeResult, setCompleteResult] = useState<CompleteResult | null>(null);

  // ── Load session on mount ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadSession() {
      try {
        const planItemId = searchParams.get('planItemId');
        const reset = searchParams.get('reset');
        const params = new URLSearchParams();
        if (planItemId) params.set('planItemId', planItemId);
        if (reset) params.set('reset', reset);
        const qs = params.toString();
        const url = qs ? `/api/session?${qs}` : '/api/session';
        const res = await fetch(url);
        if (!res.ok) {
          // 404 = no workout planned for today
          if (res.status === 404) {
            setSession(null);
            setLoading(false);
            return;
          }
          throw new Error(`Failed to load session: ${res.statusText}`);
        }
        const data: SessionData = await res.json();
        // Guard against responses missing required fields
        if (!data.sessionId || !data.exercises?.length) {
          setSession(null);
          setLoading(false);
          return;
        }
        setSession(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, []);

  // ── Derive exercise blocks ─────────────────────────────────────────────────
  const blocks = session ? groupExercises(session.exercises) : [];

  // ── Update a strength set (optimistic + POST) ──────────────────────────────
  const handleUpdateSet = useCallback(
    async (
      setId: number,
      actualWeightKg: number | null,
      actualReps: number | null,
      completed: boolean,
    ) => {
      if (!session) return;

      // Optimistic update
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sets: prev.sets.map((s) =>
            s.id === setId ? { ...s, actualWeightKg, actualReps, completed } : s,
          ),
        };
      });

      try {
        await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'set', setId, actualWeightKg, actualReps, completed }),
        });
      } catch (err) {
        console.error('Failed to persist set update:', err);
      }
    },
    [session],
  );

  // ── Update a cardio block (optimistic + POST) ──────────────────────────────
  const handleUpdateCardio = useCallback(
    async (cardioId: number, completedRounds: number, completed: boolean) => {
      if (!session) return;

      // Optimistic update
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cardio: prev.cardio.map((c) =>
            c.id === cardioId ? { ...c, completedRounds, completed } : c,
          ),
        };
      });

      try {
        await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'cardio', cardioId, completedRounds, completed }),
        });
      } catch (err) {
        console.error('Failed to persist cardio update:', err);
      }
    },
    [session],
  );

  // ── Complete the session ───────────────────────────────────────────────────
  const handleComplete = useCallback(
    async (notes: string) => {
      if (!session?.sessionId) return;

      try {
        const res = await fetch('/api/session/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.sessionId, notes }),
        });
        if (res.ok) {
          const result: CompleteResult = await res.json();
          setCompleteResult(result);
        }
      } catch (err) {
        console.error('Failed to complete session:', err);
      }
      // Navigate away or show a done state regardless
      window.location.href = '/log';
    },
    [session],
  );

  // ── Derived: overall progress counts ──────────────────────────────────────
  const totalSets = session?.sets.length ?? 0;
  const completedSets = session?.sets.filter((s) => s.completed).length ?? 0;
  const totalCardio = session?.cardio.length ?? 0;
  const completedCardio = session?.cardio.filter((c) => c.completed).length ?? 0;
  const progressCompleted = completedSets + completedCardio;
  const progressTotal = totalSets + totalCardio;

  // ── Check if all blocks are done ──────────────────────────────────────────
  const allDone =
    blocks.length > 0 &&
    blocks.every((block) => {
      const comp = blockCompletion(block, session?.sets ?? [], session?.cardio ?? []);
      return comp.completed;
    });

  // Auto-advance block when current block becomes complete
  useEffect(() => {
    if (!session || blocks.length === 0) return;
    const currentComp = blockCompletion(
      blocks[currentBlockIndex],
      session.sets,
      session.cardio,
    );
    if (currentComp.completed && currentBlockIndex < blocks.length - 1) {
      setCurrentBlockIndex((i) => i + 1);
    }
  }, [session, blocks, currentBlockIndex]);

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderBlock(block: ExerciseBlock) {
    if (!session) return null;

    if (block.kind === 'single') {
      const ex = block.exercise;

      if (ex.type === 'cardio_intervals') {
        const cardioState = session.cardio.find((c) => c.exerciseName === ex.canonicalName);
        if (!cardioState) return null;
        return (
          <CardioIntervals
            key={ex.name}
            exerciseName={ex.name}
            cardio={cardioState}
            coachCue={ex.coachCue}
            onUpdateCardio={handleUpdateCardio}
          />
        );
      }

      if (ex.type === 'cardio_steady') {
        const cardioState = session.cardio.find((c) => c.exerciseName === ex.canonicalName);
        if (!cardioState) return null;
        return (
          <CardioSteady
            key={ex.name}
            exerciseName={ex.name}
            cardio={cardioState}
            coachCue={ex.coachCue}
            workoutDescription={blocks.length === 1 ? session.workoutDescription : null}
            onUpdateCardio={handleUpdateCardio}
          />
        );
      }

      // Strength / bodyweight
      const exSets = session.sets.filter((s) => s.exerciseName === ex.canonicalName);
      return (
        <StrengthExercise
          key={ex.name}
          exerciseName={ex.name}
          sets={exSets}
          durationSeconds={ex.durationSeconds}
          isCurrent
          onUpdateSet={handleUpdateSet}
        />
      );
    }

    // Superset block
    const restSeconds = block.exercises[0]?.restSeconds ?? null;
    const supersetExercises = block.exercises.map((ex) => ({
      name: ex.name,
      sets: session.sets.filter((s) => s.exerciseName === ex.canonicalName),
      durationSeconds: ex.durationSeconds,
    }));

    return (
      <SupersetBlock
        key={`superset-${block.groupId}`}
        groupName={String(block.groupId)}
        exercises={supersetExercises}
        restSeconds={restSeconds}
        onUpdateSet={handleUpdateSet}
      />
    );
  }

  // ── States ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="sm" sx={{ pt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  if (!session) {
    return (
      <Container maxWidth="sm" sx={{ pt: 6, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No workout planned for today.
        </Typography>
      </Container>
    );
  }

  if (isComplete && completeResult) {
    return (
      <SessionComplete
        compliancePct={completeResult.compliancePct}
        weightChanges={completeResult.weightChanges}
        ceilingCheck={completeResult.ceilingCheck}
        setsCompleted={completedSets}
        exercisesCompleted={blocks.filter((b) =>
          blockCompletion(b, session.sets, session.cardio).completed,
        ).length}
        onClose={handleComplete}
      />
    );
  }

  // ── Exercise list items for nav ────────────────────────────────────────────
  const exerciseListItems = blocks.map((block, idx) => {
    const comp = blockCompletion(block, session.sets, session.cardio);
    const dur = block.kind === 'single' ? block.exercise.durationSeconds : null;
    return {
      name: blockDisplayName(block),
      completed: comp.completed,
      current: idx === currentBlockIndex,
      setsCompleted: comp.setsCompleted,
      setsTotal: comp.setsTotal,
      durationSeconds: dur,
    };
  });

  // ── Main UI ────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="sm" sx={{ pt: 2, pb: 8 }}>
      {/* Session header */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" fontWeight={800} lineHeight={1.2}>
            {session.sessionTitle}
          </Typography>
          {session.resumed && (
            <Typography variant="caption" color="text.secondary">
              Resuming previous session
            </Typography>
          )}
        </Box>
        <Tooltip title="Reset session — clears progress and reloads from plan">
          <IconButton
            size="small"
            onClick={() => {
              const planItemId = searchParams.get('planItemId');
              const params = new URLSearchParams();
              if (planItemId) params.set('planItemId', planItemId);
              params.set('reset', 'true');
              window.location.href = `/session?${params.toString()}`;
            }}
            sx={{ mt: 0.5, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
          >
            <RestartAltIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Progress bar */}
      <Box sx={{ mb: 3 }}>
        <SessionProgress completed={progressCompleted} total={progressTotal} />
      </Box>

      {/* Coach cues */}
      {session.coachCues && (
        <Box
          sx={{
            mb: 2.5,
            p: 1.5,
            borderRadius: '10px',
            backgroundColor: 'action.hover',
            borderLeft: '3px solid #f59e0b',
          }}
        >
          <Typography variant="caption" color="text.secondary" display="block" mb={0.25} fontWeight={700}>
            Coach Cues
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
            {session.coachCues}
          </Typography>
        </Box>
      )}

      {/* Current exercise block */}
      <Box sx={{ mb: 3 }}>
        {blocks[currentBlockIndex] && renderBlock(blocks[currentBlockIndex])}
      </Box>

      {/* All done banner */}
      {allDone && !isComplete && (
        <Box
          sx={{
            mb: 3,
            p: 2,
            borderRadius: '12px',
            backgroundColor: '#22c55e20',
            border: '1px solid #22c55e',
            textAlign: 'center',
          }}
        >
          <Typography variant="subtitle1" fontWeight={700} color="#22c55e">
            All exercises complete. Ready to log?
          </Typography>
          <Typography
            component="button"
            variant="body2"
            onClick={() => setIsComplete(true)}
            sx={{
              mt: 1,
              px: 3,
              py: 1,
              borderRadius: '8px',
              backgroundColor: '#22c55e',
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Finish Session
          </Typography>
        </Box>
      )}

      {/* Exercise navigation list */}
      <ExerciseList exercises={exerciseListItems} onSelect={setCurrentBlockIndex} />
    </Container>
  );
}
