'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import type {
  SessionSetState,
  SessionCardioState,
  ParsedExercise,
  ExerciseBlock,
  NormalizedExercise,
  NormalizedCardio,
  Section,
} from '@/lib/types';
import { buildBlocksFromSets } from '@/lib/buildBlocks';

// ── Types ────────────────────────────────────────────────────────────────────

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

// ── Legacy groupExercises (for pre-Week-14 sessions with exercises[]) ────────

const SECTION_ORDER: Record<string, number> = {
  warm_up: 0,
  activation: 1,
  main_work: 2,
  accessory: 3,
  finisher: 4,
  cool_down: 5,
};

function sectionSortKey(section: string | null | undefined): number {
  return section ? (SECTION_ORDER[section] ?? 99) : 99;
}

function blockSortKey(block: ExerciseBlock): { section: number; order: number } {
  const order =
    block.kind === 'superset'
      ? Math.min(...block.exercises.map((e) => e.order))
      : block.kind === 'cardio'
        ? block.exercise.order
        : block.exercise.order;
  return { section: sectionSortKey(block.section), order };
}

/** Convert ParsedExercise[] into ExerciseBlock[] (legacy path) */
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
    const section = (sectionMap.get(ex.canonicalName) ?? sectionMap.get(ex.name) ?? 'main_work') as Section;

    if (ex.supersetGroup == null) {
      // Check if this is a cardio exercise
      if (ex.type === 'cardio_intervals' || ex.type === 'cardio_steady' || ex.type === 'ruck') {
        const normCardio: NormalizedCardio = {
          name: ex.canonicalName,
          type: ex.type as 'cardio_intervals' | 'cardio_steady' | 'ruck',
          order: ex.order,
          cardioType: ex.type === 'cardio_intervals' ? 'intervals' : 'steady_state',
          prescribedRounds: ex.rounds,
          prescribedDurationMin: ex.durationSeconds != null ? Math.round(ex.durationSeconds / 60) : null,
          targetIntensity: ex.targetIntensity,
          intervalWorkSeconds: null,
          intervalRestSeconds: null,
          restSeconds: ex.restSeconds,
          coachCue: ex.coachCue,
          planExerciseId: null,
          section,
        };
        blocks.push({ kind: 'cardio', exercise: normCardio, section });
      } else {
        const norm: NormalizedExercise = {
          name: ex.canonicalName,
          type: ex.type,
          order: ex.order,
          supersetGroup: null,
          sets: ex.sets,
          prescribedRepsDisplay: ex.reps?.toString() ?? null,
          prescribedWeightKg: ex.weightKg,
          prescribedDurationS: ex.durationSeconds,
          restSeconds: ex.restSeconds,
          coachCue: ex.coachCue,
          planExerciseId: null,
          laterality: 'bilateral',
        };
        blocks.push({ kind: 'single', exercise: norm, section });
      }
    } else {
      if (!seenGroups.has(ex.supersetGroup)) {
        seenGroups.add(ex.supersetGroup);
        const grouped = exercises.filter((e) => e.supersetGroup === ex.supersetGroup);
        const groupSection = (sectionMap.get(grouped[0]?.canonicalName) ?? sectionMap.get(grouped[0]?.name) ?? 'main_work') as Section;
        // Find rest from any exercise in the group
        const restSeconds = grouped.find((e) => e.restSeconds != null && e.restSeconds > 0)?.restSeconds ?? null;
        blocks.push({
          kind: 'superset',
          groupId: ex.supersetGroup,
          section: groupSection,
          restSeconds,
          exercises: grouped.map((e) => ({
            name: e.canonicalName,
            type: e.type,
            order: e.order,
            supersetGroup: e.supersetGroup,
            sets: e.sets,
            prescribedRepsDisplay: e.reps?.toString() ?? null,
            prescribedWeightKg: e.weightKg,
            prescribedDurationS: e.durationSeconds,
            restSeconds: e.restSeconds,
            coachCue: e.coachCue,
            planExerciseId: null,
            laterality: 'bilateral' as const,
          })),
        });
      }
    }
  }

  // Sort by section order, then exercise order
  blocks.sort((a, b) => {
    const ka = blockSortKey(a);
    const kb = blockSortKey(b);
    if (ka.section !== kb.section) return ka.section - kb.section;
    return ka.order - kb.order;
  });

  return blocks;
}

// ── Block completion helper ──────────────────────────────────────────────────

export function blockCompletion(
  block: ExerciseBlock,
  sets: SessionSetState[],
  cardio: SessionCardioState[],
): { setsCompleted: number; setsTotal: number; completed: boolean } {
  if (block.kind === 'cardio') {
    const c = cardio.find((c) => c.exerciseName === block.exercise.name);
    return {
      setsCompleted: c?.completedRounds ?? 0,
      setsTotal: c?.prescribedRounds ?? 1,
      completed: c?.completed ?? false,
    };
  }

  if (block.kind === 'single') {
    const ex = block.exercise;
    const exSets = sets.filter((s) => s.exerciseName === ex.name);
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
    const exSets = sets.filter((s) => s.exerciseName === ex.name);
    doneSets += exSets.filter((s) => s.completed).length;
    totalSets += exSets.length;
  }
  return {
    setsCompleted: doneSets,
    setsTotal: totalSets,
    completed: totalSets > 0 && doneSets === totalSets,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSession() {
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
          if (res.status === 404) {
            setSession(null);
            setLoading(false);
            return;
          }
          throw new Error(`Failed to load session: ${res.statusText}`);
        }
        const data: SessionData = await res.json();
        const hasExerciseData = (data.exercises?.length > 0) || (data.sets?.length > 0) || (data.cardio?.length > 0);
        if (!data.sessionId || !hasExerciseData) {
          setSession(null);
          setLoading(false);
          return;
        }
        setSession(data);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derive exercise blocks ─────────────────────────────────────────────────
  const useSetBasedBlocks = session && (isEditMode || session.exercises.length === 0);
  const blocks: ExerciseBlock[] = session
    ? (useSetBasedBlocks
        ? buildBlocksFromSets(session.sets, session.cardio)
        : groupExercises(session.exercises, session.sets, session.cardio))
    : [];

  // ── Update a strength set (optimistic + POST) ─────────────────────────────
  const handleUpdateSet = useCallback(
    async (
      setId: number,
      actualWeightKg: number | null,
      actualReps: number | null,
      completed: boolean,
      actualDurationS?: number | null,
    ) => {
      if (!session) return;

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

  // ── Submit RPE feedback for an exercise ────────────────────────────────────
  const handleRpeSelect = useCallback(
    async (exerciseName: string, rpe: number) => {
      if (!session?.sessionId) return;

      setRpeFeedback((prev) => ({ ...prev, [exerciseName]: rpe }));

      // Find exercise order: from exercises[] (legacy) or from first set (structured)
      let exerciseOrder = 0;
      const exercise = session.exercises.find((e) => e.canonicalName === exerciseName || e.name === exerciseName);
      if (exercise) {
        exerciseOrder = exercise.order;
      } else {
        const firstSet = session.sets.find((s) => s.exerciseName === exerciseName);
        if (firstSet) exerciseOrder = firstSet.exerciseOrder;
      }

      try {
        await fetch('/api/session/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionLogId: session.sessionId,
            exerciseName,
            exerciseOrder,
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

      let exerciseOrder = 0;
      const exercise = session.exercises.find((e) => e.canonicalName === exerciseName || e.name === exerciseName);
      if (exercise) {
        exerciseOrder = exercise.order;
      } else {
        const firstSet = session.sets.find((s) => s.exerciseName === exerciseName);
        if (firstSet) exerciseOrder = firstSet.exerciseOrder;
      }

      try {
        await fetch('/api/session/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionLogId: session.sessionId,
            exerciseName,
            exerciseOrder,
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

  // ── Update a cardio block (optimistic + POST) ─────────────────────────────
  const handleUpdateCardio = useCallback(
    async (cardioId: number, completedRounds: number, completed: boolean, actualDurationMin?: number | null, roundData?: string | null) => {
      if (!session) return;

      setSession((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          cardio: prev.cardio.map((c) =>
            c.id === cardioId
              ? { ...c, completedRounds, completed, actualDurationMin: actualDurationMin ?? c.actualDurationMin, roundData: roundData ?? c.roundData }
              : c,
          ),
        };
      });

      try {
        await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'cardio', cardioId, completedRounds, completed, actualDurationMin, roundData }),
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

  // ── Mark session as complete (computes compliance from current state) ──────
  const markComplete = useCallback(() => {
    if (!session) return;
    const doneSets = session.sets.filter((s) => s.completed).length;
    const doneCardio = session.cardio.filter((c) => c.completed).length;
    const total = session.sets.length + session.cardio.length;
    const done = doneSets + doneCardio;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const changes = session.sets
      .filter((s) => s.actualWeightKg != null && s.prescribedWeightKg != null && s.actualWeightKg !== s.prescribedWeightKg)
      .map((s) => ({ exercise: s.exerciseName, set: s.setNumber, from: s.prescribedWeightKg, to: s.actualWeightKg }));
    setCompleteResult({ compliancePct: pct, weightChanges: changes, ceilingCheck: null });
    setIsComplete(true);
  }, [session]);

  // ── Reset session ──────────────────────────────────────────────────────────
  const resetSession = useCallback(() => {
    const planItemId = searchParams.get('planItemId');
    const params = new URLSearchParams();
    if (planItemId) params.set('planItemId', planItemId);
    params.set('reset', 'true');
    window.location.href = `/session?${params.toString()}`;
  }, [searchParams]);

  // ── Derived: overall progress counts ───────────────────────────────────────
  const totalSets = session?.sets.length ?? 0;
  const completedSets = session?.sets.filter((s) => s.completed).length ?? 0;
  const totalCardio = session?.cardio.length ?? 0;
  const completedCardio = session?.cardio.filter((c) => c.completed).length ?? 0;
  const progressCompleted = completedSets + completedCardio;
  const progressTotal = totalSets + totalCardio;

  // ── Check if all blocks are done ───────────────────────────────────────────
  const allDone =
    blocks.length > 0 &&
    blocks.every((block) => {
      const comp = blockCompletion(block, session?.sets ?? [], session?.cardio ?? []);
      return comp.completed;
    });

  // ── Auto-advance block when current block becomes complete ─────────────────
  // Delay: don't auto-advance supersets until RPE is entered for all exercises,
  // to give the user time to rate each exercise. Singles advance immediately.
  useEffect(() => {
    if (!session || blocks.length === 0) return;
    const block = blocks[currentBlockIndex];
    if (!block) return;
    const currentComp = blockCompletion(block, session.sets, session.cardio);
    if (!currentComp.completed || currentBlockIndex >= blocks.length - 1) return;

    // For supersets, wait until RPE is entered for all exercises in the group
    if (block.kind === 'superset') {
      const allRpeEntered = block.exercises.every(
        (ex) => rpeFeedback[ex.name] != null,
      );
      if (!allRpeEntered) return;
    }

    setCurrentBlockIndex((i) => i + 1);
  }, [session, blocks, currentBlockIndex, rpeFeedback]);

  // ── Helper: get coach cue for an exercise ─────────────────────────────────
  const getCoachCue = useCallback(
    (exerciseName: string): string | null => {
      if (!session) return null;
      const set = session.sets.find((s) => s.exerciseName === exerciseName);
      if (set?.coachCue) return set.coachCue;
      const c = session.cardio.find((c) => c.exerciseName === exerciseName);
      return c?.coachCue ?? null;
    },
    [session],
  );

  return {
    // State
    session,
    loading,
    error,
    blocks,
    currentBlockIndex,
    isComplete,
    completeResult,
    rpeFeedback,
    exerciseNotes,
    editNotes,
    isEditMode,
    // Derived
    progressCompleted,
    progressTotal,
    completedSets,
    allDone,
    // Actions
    handleUpdateSet,
    handleUpdateCardio,
    handleRpeSelect,
    handleExerciseNotesChange,
    handleComplete,
    handleSaveEdits,
    handleUndoComplete,
    setCurrentBlockIndex,
    setIsComplete,
    markComplete,
    setEditNotes,
    resetSession,
    getCoachCue,
  };
}
