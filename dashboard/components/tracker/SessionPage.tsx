'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Typography, CircularProgress, Alert, Container, IconButton, Tooltip, TextField, Button, Card, CardContent } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type { SessionSetState, SessionCardioState, ParsedExercise } from '@/lib/types';
import SessionProgress from './SessionProgress';
import ExerciseList from './ExerciseList';
import StrengthExercise from './StrengthExercise';
import SupersetBlock from './SupersetBlock';
import CardioIntervals from './CardioIntervals';
import CardioSteady from './CardioSteady';
import SessionComplete from './SessionComplete';
import SectionHeader from '@/components/plan/SectionHeader';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionData {
  sessionId: number | null;
  sessionTitle: string;
  sessionType: string;
  exercises: ParsedExercise[];
  sets: SessionSetState[];
  cardio: SessionCardioState[];
  feedback: Array<{ exerciseName: string; exerciseOrder: number; rpe: number; notes?: string | null }>;
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
  | { kind: 'single'; exercise: ParsedExercise; section?: string | null }
  | { kind: 'superset'; groupId: number; exercises: ParsedExercise[]; section?: string | null };

// ── Helper: group exercises into blocks ───────────────────────────────────────

function groupExercises(
  exercises: ParsedExercise[],
  sets: SessionSetState[] = [],
  cardio: SessionCardioState[] = [],
): ExerciseBlock[] {
  const blocks: ExerciseBlock[] = [];
  const seenGroups = new Set<number>();

  // Build a section lookup from sets and cardio data
  const sectionMap = new Map<string, string | null>();
  for (const s of sets) {
    if (s.section && !sectionMap.has(s.exerciseName)) {
      sectionMap.set(s.exerciseName, s.section);
    }
  }
  for (const c of cardio) {
    if (c.section && !sectionMap.has(c.exerciseName)) {
      sectionMap.set(c.exerciseName, c.section);
    }
  }

  for (const ex of exercises) {
    const section = sectionMap.get(ex.canonicalName) ?? sectionMap.get(ex.name) ?? null;
    if (ex.supersetGroup == null) {
      blocks.push({ kind: 'single', exercise: ex, section });
    } else {
      if (!seenGroups.has(ex.supersetGroup)) {
        seenGroups.add(ex.supersetGroup);
        const grouped = exercises.filter((e) => e.supersetGroup === ex.supersetGroup);
        const groupSection = sectionMap.get(grouped[0]?.canonicalName) ?? sectionMap.get(grouped[0]?.name) ?? null;
        blocks.push({ kind: 'superset', groupId: ex.supersetGroup, exercises: grouped, section: groupSection });
      }
    }
  }

  return blocks;
}

// ── Helper: build exercise blocks from set/cardio data (edit mode) ────────────

function buildBlocksFromSets(
  sets: SessionSetState[],
  cardio: SessionCardioState[],
): ExerciseBlock[] {
  const blocks: ExerciseBlock[] = [];
  const seenExercises = new Set<string>();
  const seenGroups = new Set<number>();

  for (const set of sets) {
    if (seenExercises.has(set.exerciseName)) continue;
    seenExercises.add(set.exerciseName);

    if (set.supersetGroup != null) {
      if (!seenGroups.has(set.supersetGroup)) {
        seenGroups.add(set.supersetGroup);
        const groupSets = sets.filter(s => s.supersetGroup === set.supersetGroup);
        const exerciseNames = [...new Set(groupSets.map(s => s.exerciseName))];
        blocks.push({
          kind: 'superset',
          groupId: set.supersetGroup,
          section: set.section,
          exercises: exerciseNames.map(name => ({
            name,
            canonicalName: name,
            type: 'strength' as const,
            order: groupSets.find(s => s.exerciseName === name)!.exerciseOrder,
            supersetGroup: set.supersetGroup,
            sets: groupSets.filter(s => s.exerciseName === name).length,
            reps: null,
            weightKg: null,
            durationSeconds: groupSets.find(s => s.exerciseName === name)?.prescribedDurationS ?? null,
            restSeconds: null,
            rounds: null,
            targetIntensity: null,
            coachCue: null,
          })),
        });
      }
    } else {
      const exSets = sets.filter(s => s.exerciseName === set.exerciseName);
      blocks.push({
        kind: 'single',
        section: set.section,
        exercise: {
          name: set.exerciseName,
          canonicalName: set.exerciseName,
          type: 'strength' as const,
          order: set.exerciseOrder,
          supersetGroup: null,
          sets: exSets.length,
          reps: null,
          weightKg: null,
          durationSeconds: exSets[0]?.prescribedDurationS ?? null,
          restSeconds: null,
          rounds: null,
          targetIntensity: null,
          coachCue: null,
        },
      });
    }
  }

  for (const c of cardio) {
    blocks.push({
      kind: 'single',
      section: c.section,
      exercise: {
        name: c.exerciseName,
        canonicalName: c.exerciseName,
        type: c.cardioType === 'intervals' ? 'cardio_intervals' as const : 'cardio_steady' as const,
        order: blocks.length,
        supersetGroup: null,
        sets: 0,
        reps: null,
        weightKg: null,
        durationSeconds: c.prescribedDurationMin ? c.prescribedDurationMin * 60 : null,
        restSeconds: null,
        rounds: c.prescribedRounds,
        targetIntensity: c.targetIntensity,
        coachCue: null,
      },
    });
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

// ── Semantic colors ────────────────────────────────────────────────────────────

const semanticColors = {
  body: '#3b82f6',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const searchParams = useSearchParams();
  const isEditMode = searchParams.get('edit') === 'true';
  const editSessionLogId = searchParams.get('sessionLogId');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [completeResult, setCompleteResult] = useState<CompleteResult | null>(null);
  const [rpeFeedback, setRpeFeedback] = useState<Record<string, number>>({});
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  const [editNotes, setEditNotes] = useState('');

  // ── Load session on mount ──────────────────────────────────────────────────
  useEffect(() => {
    async function loadSession() {
      try {
        if (isEditMode && editSessionLogId) {
          const res = await fetch(`/api/session/edit?sessionLogId=${editSessionLogId}`);
          if (!res.ok) {
            if (res.status === 403) {
              setError('Can only edit current week sessions');
            } else {
              setError('Session not found');
            }
            setLoading(false);
            return;
          }
          const data = await res.json();
          setSession({
            sessionId: data.sessionLogId,
            sessionTitle: data.sessionTitle,
            sessionType: data.sessionType,
            exercises: [],
            sets: data.sets,
            cardio: data.cardio,
            feedback: data.feedback || [],
            coachCues: null,
            workoutDescription: null,
            resumed: false,
          });
          if (data.feedback?.length) {
            const rpeMap: Record<string, number> = {};
            const notesMap: Record<string, string> = {};
            for (const f of data.feedback) {
              rpeMap[f.exerciseName] = f.rpe;
              if (f.notes) notesMap[f.exerciseName] = f.notes;
            }
            setRpeFeedback(rpeMap);
            setExerciseNotes(notesMap);
          }
          setEditNotes(data.notes || '');
          setLoading(false);
          return;
        }

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
        // Restore saved RPE feedback and notes
        if (data.feedback?.length) {
          const rpeMap: Record<string, number> = {};
          const notesMap: Record<string, string> = {};
          for (const f of data.feedback) {
            rpeMap[f.exerciseName] = f.rpe;
            if (f.notes) notesMap[f.exerciseName] = f.notes;
          }
          setRpeFeedback(rpeMap);
          setExerciseNotes(notesMap);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    }
    loadSession();
  }, []);

  // ── Derive exercise blocks ─────────────────────────────────────────────────
  const blocks = session
    ? (isEditMode ? buildBlocksFromSets(session.sets, session.cardio) : groupExercises(session.exercises, session.sets, session.cardio))
    : [];

  // ── Update a strength set (optimistic + POST) ──────────────────────────────
  const handleUpdateSet = useCallback(
    async (
      setId: number,
      actualWeightKg: number | null,
      actualReps: number | null,
      completed: boolean,
      actualDurationS?: number | null,
    ) => {
      if (!session) return;

      // Optimistic update
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sets: prev.sets.map((s) =>
            s.id === setId
              ? { ...s, actualWeightKg, actualReps, completed, actualDurationS: actualDurationS ?? s.actualDurationS }
              : s,
          ),
        };
      });

      try {
        await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'set', setId, actualWeightKg, actualReps, completed, actualDurationS }),
        });
      } catch (err) {
        console.error('Failed to persist set update:', err);
      }
    },
    [session],
  );

  // ── Submit RPE feedback for an exercise ──────────────────────────────────
  const handleRpeSelect = useCallback(
    async (exerciseName: string, rpe: number) => {
      if (!session?.sessionId) return;

      setRpeFeedback((prev) => ({ ...prev, [exerciseName]: rpe }));

      const exercise = session.exercises.find((e) => e.canonicalName === exerciseName || e.name === exerciseName);

      try {
        await fetch('/api/session/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionLogId: session.sessionId,
            exerciseName,
            exerciseOrder: exercise?.order ?? 0,
            rpe,
            notes: exerciseNotes[exerciseName] ?? null,
          }),
        });
      } catch (err) {
        console.error('Failed to save RPE:', err);
      }
    },
    [session, exerciseNotes],
  );

  // ── Update exercise notes (debounced save with RPE) ────────────────────────
  const handleExerciseNotesChange = useCallback(
    async (exerciseName: string, notes: string) => {
      if (!session?.sessionId) return;

      setExerciseNotes((prev) => ({ ...prev, [exerciseName]: notes }));

      const rpe = rpeFeedback[exerciseName];
      if (rpe == null) return; // Only persist notes if RPE has been set

      const exercise = session.exercises.find((e) => e.canonicalName === exerciseName || e.name === exerciseName);

      try {
        await fetch('/api/session/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionLogId: session.sessionId,
            exerciseName,
            exerciseOrder: exercise?.order ?? 0,
            rpe,
            notes,
          }),
        });
      } catch (err) {
        console.error('Failed to save exercise notes:', err);
      }
    },
    [session, rpeFeedback],
  );

  // ── Update a cardio block (optimistic + POST) ──────────────────────────────
  const handleUpdateCardio = useCallback(
    async (cardioId: number, completedRounds: number, completed: boolean, actualDurationMin?: number | null) => {
      if (!session) return;

      // Optimistic update
      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cardio: prev.cardio.map((c) =>
            c.id === cardioId
              ? { ...c, completedRounds, completed, actualDurationMin: actualDurationMin ?? c.actualDurationMin }
              : c,
          ),
        };
      });

      try {
        await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'cardio', cardioId, completedRounds, completed, actualDurationMin }),
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
          window.location.href = '/log';
        }
      } catch (err) {
        console.error('Failed to complete session:', err);
      }
    },
    [session],
  );

  // ── Save edits (edit mode) ─────────────────────────────────────────────────
  const handleSaveEdits = useCallback(async () => {
    if (!session?.sessionId) return;

    const setUpdates = session.sets.map((s) => ({
      id: s.id!,
      actualWeightKg: s.actualWeightKg,
      actualReps: s.actualReps,
      actualDurationS: s.actualDurationS ?? null,
    }));

    const cardioUpdates = session.cardio.map((c) => ({
      id: c.id!,
      completedRounds: c.completedRounds,
      actualDurationMin: c.actualDurationMin ?? null,
    }));

    const feedbackUpdates = Object.entries(rpeFeedback).map(([exerciseName, rpe]) => ({
      exerciseName,
      exerciseOrder: 0,
      rpe,
    }));

    try {
      const res = await fetch('/api/session/edit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionLogId: session.sessionId,
          sets: setUpdates,
          cardio: cardioUpdates,
          feedback: feedbackUpdates,
          notes: editNotes,
        }),
      });
      if (res.ok) {
        window.history.back();
      }
    } catch (err) {
      console.error('Failed to save edits:', err);
    }
  }, [session, rpeFeedback, editNotes]);

  const handleUndoComplete = useCallback(() => {
    setIsComplete(false);
    setCompleteResult(null);
  }, []);

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

  // ── Helper: get coach cue for the first set of an exercise ─────────────────
  function getCoachCue(exerciseName: string): string | null {
    if (!session) return null;
    const set = session.sets.find(s => s.exerciseName === exerciseName);
    if (set?.coachCue) return set.coachCue;
    const cardio = session.cardio.find(c => c.exerciseName === exerciseName);
    return cardio?.coachCue ?? null;
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderSimplifiedBlock(block: ExerciseBlock) {
    if (!session) return null;
    if (block.kind !== 'single') return null;
    const ex = block.exercise;
    const exSets = session.sets.filter((s) => s.exerciseName === ex.canonicalName);
    const allDoneLocal = exSets.length > 0 && exSets.every((s) => s.completed);
    const coachCue = getCoachCue(ex.canonicalName) ?? ex.coachCue;
    const description = ex.durationSeconds
      ? `${ex.durationSeconds}s`
      : exSets.length > 0
        ? `${exSets.length} set${exSets.length > 1 ? 's' : ''}`
        : null;

    const handleDoneToggle = () => {
      for (const s of exSets) {
        handleUpdateSet(s.id!, s.actualWeightKg ?? s.prescribedWeightKg, s.actualReps ?? s.prescribedReps, !allDoneLocal);
      }
    };

    return (
      <Card
        key={ex.name}
        variant="outlined"
        sx={{
          borderRadius: '12px',
          borderColor: allDoneLocal ? semanticColors.body : 'divider',
          opacity: allDoneLocal ? 0.7 : 1,
        }}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 }, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            onClick={handleDoneToggle}
            sx={{
              width: 36,
              height: 36,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
              border: '2px solid',
              borderColor: allDoneLocal ? semanticColors.body : 'divider',
              backgroundColor: allDoneLocal ? `${semanticColors.body}18` : 'transparent',
              transition: 'all 0.15s ease',
            }}
          >
            {allDoneLocal && (
              <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: semanticColors.body }}>
                ✓
              </Typography>
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ textDecoration: allDoneLocal ? 'line-through' : 'none' }}
            >
              {ex.name}
            </Typography>
            {description && (
              <Typography variant="caption" color="text.secondary">
                {description}
              </Typography>
            )}
            {coachCue && (
              <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', color: 'text.secondary', mt: 0.25 }}>
                {coachCue}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  }

  function renderBlock(block: ExerciseBlock) {
    if (!session) return null;

    // Simplified view for warm-up and cool-down exercises
    const section = block.section;
    if (section === 'warm_up' || section === 'cool_down') {
      if (block.kind === 'single') {
        return renderSimplifiedBlock(block);
      }
      // Supersets in warm-up/cool-down: render each exercise simplified
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {block.exercises.map((ex) =>
            renderSimplifiedBlock({ kind: 'single', exercise: ex, section })
          )}
        </Box>
      );
    }

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
            coachCue={cardioState.coachCue ?? ex.coachCue}
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
            coachCue={cardioState.coachCue ?? ex.coachCue}
            workoutDescription={blocks.length === 1 ? session.workoutDescription : null}
            onUpdateCardio={handleUpdateCardio}
          />
        );
      }

      // Strength / bodyweight
      const exSets = session.sets.filter((s) => s.exerciseName === ex.canonicalName);
      const coachCue = getCoachCue(ex.canonicalName) ?? ex.coachCue;
      return (
        <Box key={ex.name}>
          <StrengthExercise
            exerciseName={ex.name}
            sets={exSets}
            durationSeconds={ex.durationSeconds}
            restSeconds={exSets[0]?.restSeconds ?? null}
            isCurrent
            onUpdateSet={handleUpdateSet}
            rpe={rpeFeedback[ex.canonicalName] ?? null}
            onRpeSelect={(name, rpe) => handleRpeSelect(ex.canonicalName, rpe)}
            notes={exerciseNotes[ex.canonicalName] ?? ''}
            onNotesChange={(name, notes) => handleExerciseNotesChange(ex.canonicalName, notes)}
          />
          {coachCue && (
            <Typography variant="body2" sx={{ mt: 0.5, ml: 1, fontStyle: 'italic', color: 'text.secondary', fontSize: '0.8125rem' }}>
              {coachCue}
            </Typography>
          )}
        </Box>
      );
    }

    // Superset block — get rest from exercise definition or from first set in the group
    const firstGroupSet = session.sets.find(s => s.exerciseName === block.exercises[0]?.canonicalName);
    const restSeconds = block.exercises[0]?.restSeconds ?? firstGroupSet?.restSeconds ?? null;
    const supersetExercises = block.exercises.map((ex) => ({
      name: ex.name,
      sets: session.sets.filter((s) => s.exerciseName === ex.canonicalName),
      durationSeconds: ex.durationSeconds,
      rpe: rpeFeedback[ex.canonicalName] ?? null,
      notes: exerciseNotes[ex.canonicalName] ?? '',
    }));

    return (
      <SupersetBlock
        key={`superset-${block.groupId}`}
        groupName={String(block.groupId)}
        exercises={supersetExercises}
        restSeconds={restSeconds}
        onUpdateSet={handleUpdateSet}
        onRpeSelect={(name, rpe) => {
          const ex = block.exercises.find((e) => e.name === name);
          handleRpeSelect(ex?.canonicalName ?? name, rpe);
        }}
        onNotesChange={(name, notes) => {
          const ex = block.exercises.find((e) => e.name === name);
          handleExerciseNotesChange(ex?.canonicalName ?? name, notes);
        }}
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

  if (isComplete) {
    return (
      <SessionComplete
        compliancePct={completeResult?.compliancePct ?? null}
        weightChanges={completeResult?.weightChanges ?? []}
        ceilingCheck={completeResult?.ceilingCheck ?? null}
        setsCompleted={completedSets}
        exercisesCompleted={blocks.filter((b) =>
          blockCompletion(b, session.sets, session.cardio).completed,
        ).length}
        onClose={handleComplete}
        onUndo={handleUndoComplete}
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
          {isEditMode && (
            <Typography variant="caption" color="text.secondary">
              Editing completed session
            </Typography>
          )}
        </Box>
        {!isEditMode && (
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
        )}
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

      {/* Exercise blocks */}
      {isEditMode ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
          {blocks.map((block, idx) => {
            const prevSection = idx > 0 ? blocks[idx - 1].section : null;
            const showHeader = block.section && block.section !== prevSection;
            return (
              <Box key={idx}>
                {showHeader && <SectionHeader section={block.section!} />}
                {renderBlock(block)}
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box sx={{ mb: 3 }}>
          {blocks[currentBlockIndex] && (
            <>
              {blocks[currentBlockIndex].section && (
                <SectionHeader section={blocks[currentBlockIndex].section!} />
              )}
              {renderBlock(blocks[currentBlockIndex])}
            </>
          )}
        </Box>
      )}

      {/* Edit mode: Save Changes */}
      {isEditMode && (
        <Box sx={{ mb: 3 }}>
          <TextField
            label="Session Notes"
            multiline
            minRows={2}
            fullWidth
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: '12px' } }}
          />
          <Button
            variant="contained"
            fullWidth
            onClick={handleSaveEdits}
            sx={{
              minHeight: 52,
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '1rem',
              backgroundColor: semanticColors.body,
              '&:hover': { backgroundColor: '#2563eb' },
            }}
          >
            Save Changes
          </Button>
        </Box>
      )}

      {/* All done banner */}
      {allDone && !isComplete && !isEditMode && (
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
      {!isEditMode && <ExerciseList exercises={exerciseListItems} onSelect={setCurrentBlockIndex} />}
    </Container>
  );
}
