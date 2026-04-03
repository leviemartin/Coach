'use client';

import { Box, Typography, CircularProgress, Alert, Container, IconButton, Tooltip, TextField, Button } from '@mui/material';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type { ExerciseBlock, Section } from '@/lib/types';
import { formatDuration, formatRx } from '@/lib/format';
import { borders } from '@/lib/design-tokens';
import SectionDivider from '@/components/plan/SectionDivider';
import PipProgress from './PipProgress';
import ExerciseNav from './ExerciseNav';
import SetRowInput from './SetRowInput';
import SupersetBlockTracker from './SupersetBlockTracker';
import CardioIntervals from './CardioIntervals';
import CardioSteady from './CardioSteady';
import SessionComplete from './SessionComplete';
import ExerciseRpe from './ExerciseRpe';
import { useSession, blockCompletion } from './useSession';

// ── Semantic colors ──────────────────────────────────────────────────────────

const semanticColors = { body: '#3b82f6' };

// ── Component ────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const {
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
    progressCompleted,
    progressTotal,
    completedSets,
    allDone,
    handleUpdateSet,
    handleUpdateCardio,
    handleRpeSelect,
    handleExerciseNotesChange,
    handleComplete,
    handleSaveEdits,
    handleUndoComplete,
    setCurrentBlockIndex,
    advanceBlock,
    markComplete,
    setEditNotes,
    resetSession,
    getCoachCue,
  } = useSession();

  // ── Block rendering ────────────────────────────────────────────────────────

  function renderBlock(block: ExerciseBlock) {
    if (!session) return null;

    // Superset block
    if (block.kind === 'superset') {
      const groupSets = session.sets.filter((s) => s.supersetGroup === block.groupId);
      const restSeconds =
        block.restSeconds
        ?? groupSets.find((s) => s.restSeconds != null && s.restSeconds > 0)?.restSeconds
        ?? null;
      const supersetExercises = block.exercises.map((ex) => ({
        name: ex.name,
        type: ex.type,
        sets: session.sets.filter((s) => s.exerciseName === ex.name),
        prescribedRepsDisplay: ex.prescribedRepsDisplay,
        prescribedWeightKg: ex.prescribedWeightKg,
        prescribedDurationS: ex.prescribedDurationS,
        laterality: ex.laterality,
        coachCue: getCoachCue(ex.name) ?? ex.coachCue,
        rpe: rpeFeedback[ex.name] ?? null,
        notes: exerciseNotes[ex.name] ?? '',
      }));

      return (
        <SupersetBlockTracker
          key={`superset-${block.groupId}`}
          groupId={block.groupId}
          exercises={supersetExercises}
          restSeconds={restSeconds}
          onUpdateSet={handleUpdateSet}
          onRpeSelect={(name, rpe) => handleRpeSelect(name, rpe)}
          onNotesChange={(name, notes) => handleExerciseNotesChange(name, notes)}
        />
      );
    }

    // Cardio block
    if (block.kind === 'cardio') {
      const cardioState = session.cardio.find((c) => c.exerciseName === block.exercise.name);
      if (!cardioState) return null;
      const coachCue = cardioState.coachCue ?? block.exercise.coachCue;

      if (block.exercise.cardioType === 'intervals') {
        return (
          <CardioIntervals
            key={block.exercise.name}
            exerciseName={block.exercise.name}
            cardio={cardioState}
            coachCue={coachCue}
            onUpdateCardio={handleUpdateCardio}
            selectedRpe={rpeFeedback[block.exercise.name] ?? null}
            onRpeSelect={(rpe) => handleRpeSelect(block.exercise.name, rpe)}
            notes={exerciseNotes[block.exercise.name] ?? ''}
            onNotesChange={(n) => handleExerciseNotesChange(block.exercise.name, n)}
          />
        );
      }

      return (
        <CardioSteady
          key={block.exercise.name}
          exerciseName={block.exercise.name}
          cardio={cardioState}
          coachCue={coachCue}
          workoutDescription={blocks.length === 1 ? session.workoutDescription : null}
          onUpdateCardio={handleUpdateCardio}
          selectedRpe={rpeFeedback[block.exercise.name] ?? null}
          onRpeSelect={(rpe) => handleRpeSelect(block.exercise.name, rpe)}
          notes={exerciseNotes[block.exercise.name] ?? ''}
          onNotesChange={(n) => handleExerciseNotesChange(block.exercise.name, n)}
        />
      );
    }

    // Single strength/timed/carry/mobility
    const ex = block.exercise;
    const exSets = session.sets.filter((s) => s.exerciseName === ex.name);
    const coachCue = getCoachCue(ex.name) ?? ex.coachCue;
    const allExSetsComplete = exSets.length > 0 && exSets.every((s) => s.completed);
    const rxLine = formatRx(ex.sets, ex.prescribedRepsDisplay, ex.prescribedDurationS, ex.laterality);

    return (
      <Box key={ex.name}>
        {/* Exercise name */}
        <Typography sx={{
          fontFamily: '"Libre Franklin", sans-serif',
          fontSize: '1rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          mb: 0.25,
          px: 2.5,
        }}>
          {ex.name}
        </Typography>

        {/* Prescribed line */}
        {rxLine && (
          <Typography sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.75rem',
            color: '#71717a',
            mb: 0.5,
            px: 2.5,
          }}>
            {rxLine}
            {ex.prescribedWeightKg != null && ex.prescribedWeightKg > 0 && ` @ ${ex.prescribedWeightKg}kg`}
          </Typography>
        )}

        {/* Coach cue */}
        {coachCue && (
          <Typography sx={{
            fontSize: '0.75rem',
            fontStyle: 'italic',
            color: '#b45309',
            mb: 1.5,
            px: 2.5,
            pl: 3.75,
            borderLeft: '2px solid #b4530940',
            ml: 2.5,
          }}>
            {coachCue}
          </Typography>
        )}

        {/* Set rows */}
        <Box sx={{ px: 2.5 }}>
          {exSets.map((s) => (
            <SetRowInput
              key={s.id}
              set={s}
              exerciseType={ex.type}
              durationSecondsFromExercise={ex.prescribedDurationS}
              onComplete={handleUpdateSet}
            />
          ))}
        </Box>

        {/* RPE after all sets complete */}
        {allExSetsComplete && (
          <Box sx={{ px: 2.5 }}>
            <ExerciseRpe
              selectedRpe={rpeFeedback[ex.name] ?? null}
              onSelect={(rpe) => handleRpeSelect(ex.name, rpe)}
              notes={exerciseNotes[ex.name] ?? ''}
              onNotesChange={(notes) => handleExerciseNotesChange(ex.name, notes)}
            />
          </Box>
        )}
      </Box>
    );
  }

  // ── Loading / Error / Empty states ─────────────────────────────────────────

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

  // ── Completion screen ──────────────────────────────────────────────────────

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

  // ── Build nav items ────────────────────────────────────────────────────────

  const navItems = blocks.map((block, idx) => {
    const comp = blockCompletion(block, session.sets, session.cardio);
    const name =
      block.kind === 'superset'
        ? block.exercises.map((e) => e.name).join(' + ')
        : block.exercise.name;
    return {
      name,
      section: block.section as Section,
      completed: comp.completed,
      current: idx === currentBlockIndex,
      setsCompleted: comp.setsCompleted,
      setsTotal: comp.setsTotal,
    };
  });

  // ── Main UI ────────────────────────────────────────────────────────────────

  return (
    <Container maxWidth="sm" sx={{ pt: 2, pb: 8 }}>
      {/* Session header */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', px: 2.5 }}>
        <Box>
          <Typography sx={{
            fontFamily: '"Libre Franklin", sans-serif',
            fontWeight: 800,
            fontSize: '1.25rem',
            lineHeight: 1.2,
          }}>
            {session.sessionTitle}
          </Typography>
          <Typography sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.75rem',
            color: '#71717a',
            mt: 0.25,
          }}>
            {session.resumed && 'Resuming previous session'}
            {isEditMode && 'Editing completed session'}
            {!session.resumed && !isEditMode && `${progressCompleted}/${progressTotal}`}
          </Typography>
        </Box>
        {!isEditMode && (
          <Tooltip title="Reset session — clears progress and reloads from plan">
            <IconButton
              size="small"
              onClick={resetSession}
              sx={{ mt: 0.5, color: 'text.secondary', '&:hover': { color: 'error.main' } }}
            >
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Progress pips */}
      <PipProgress completed={progressCompleted} total={progressTotal} currentIndex={currentBlockIndex} />

      {/* Coach cues (session-level) */}
      {session.coachCues && (
        <Box
          sx={{
            mx: 2.5,
            mt: 1.5,
            mb: 2,
            p: 1.5,
            borderLeft: '3px solid #b45309',
            backgroundColor: '#b4530908',
          }}
        >
          <Typography sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.625rem',
            fontWeight: 700,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: '#b45309',
            mb: 0.5,
          }}>
            Coach Cues
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', color: '#71717a', fontSize: '0.8125rem' }}>
            {session.coachCues}
          </Typography>
        </Box>
      )}

      {/* Exercise blocks */}
      {isEditMode ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0, mb: 3 }}>
          {blocks.map((block, idx) => {
            const prevSection = idx > 0 ? blocks[idx - 1].section : null;
            const showDivider = block.section && block.section !== prevSection;
            return (
              <Box key={idx}>
                {showDivider && <SectionDivider section={block.section as Section} />}
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
                <SectionDivider section={blocks[currentBlockIndex].section as Section} />
              )}
              {renderBlock(blocks[currentBlockIndex])}

              {/* Manual advance button */}
              {currentBlockIndex < blocks.length - 1 && (
                <Box sx={{ px: 2.5, mt: 2 }}>
                  <Box
                    component="button"
                    onClick={advanceBlock}
                    sx={{
                      width: '100%',
                      py: 1.25,
                      border: `2px solid ${borders.hard}`,
                      backgroundColor: 'transparent',
                      color: borders.hard,
                      fontFamily: '"JetBrains Mono", monospace',
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: '#f0f0eb' },
                    }}
                  >
                    Next Exercise →
                  </Box>
                </Box>
              )}
            </>
          )}
        </Box>
      )}

      {/* Edit mode: notes + save */}
      {isEditMode && (
        <Box sx={{ mx: 2.5, mb: 3 }}>
          <TextField
            label="Session Notes"
            multiline
            minRows={2}
            fullWidth
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
          />
          <Button
            variant="contained"
            fullWidth
            onClick={handleSaveEdits}
            sx={{
              minHeight: 52,
              borderRadius: 0,
              fontWeight: 700,
              fontSize: '1rem',
              fontFamily: '"JetBrains Mono", monospace',
              backgroundColor: semanticColors.body,
              '&:hover': { backgroundColor: '#2563eb' },
            }}
          >
            Save Changes
          </Button>
        </Box>
      )}

      {/* Exercise navigation */}
      {!isEditMode && <ExerciseNav items={navItems} onSelect={setCurrentBlockIndex} />}

      {/* Finish session — below nav, requires deliberate scroll */}
      {!isComplete && !isEditMode && (
        <Box
          sx={{
            mx: 2.5,
            mb: 3,
            mt: 3,
            p: 2,
            border: `2px solid ${allDone ? '#22c55e' : borders.hard}`,
            textAlign: 'center',
          }}
        >
          {allDone ? (
            <Typography sx={{ fontWeight: 700, color: '#22c55e', fontSize: '1rem' }}>
              All exercises complete. Ready to log?
            </Typography>
          ) : (
            <Typography sx={{ fontWeight: 700, color: '#71717a', fontSize: '0.875rem' }}>
              {progressCompleted}/{progressTotal} done — end early?
            </Typography>
          )}
          <Box
            component="button"
            onClick={() => markComplete()}
            sx={{
              mt: 1.5,
              px: 3,
              py: 1,
              backgroundColor: allDone ? '#22c55e' : borders.hard,
              color: '#fff',
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontFamily: '"JetBrains Mono", monospace',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              '&:hover': { backgroundColor: allDone ? '#16a34a' : '#3f3f46' },
            }}
          >
            Finish Session
          </Box>
        </Box>
      )}
    </Container>
  );
}
