'use client';

import React, { useState } from 'react';
import {
  Box, Typography, LinearProgress, Card, CardContent,
  Chip, Collapse, TextField, IconButton,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckIcon from '@mui/icons-material/Check';
import type { PlanItem, SubTask } from '@/lib/types';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import WorkoutDisplay from '@/components/WorkoutDisplay';

interface TrainingPlanTableProps {
  items: PlanItem[];
  readOnly?: boolean;
  onUpdateSubTasks?: (id: number, subTasks: SubTask[]) => void;
  onUpdateNotes?: (id: number, notes: string) => void;
}

/**
 * Generate default sub-tasks based on session type when none exist.
 */
function generateDefaultSubTasks(sessionType: string): SubTask[] {
  const lower = sessionType.toLowerCase();

  if (lower.includes('family')) {
    return [
      { key: 'rest', label: 'Rest Day', completed: false },
      { key: 'sleep', label: 'Sleep', completed: false },
    ];
  }
  if (lower === 'rest' || lower.includes('rest day')) {
    return [
      { key: 'rest', label: 'Rest Day', completed: false },
      { key: 'sleep', label: 'Sleep', completed: false },
    ];
  }
  if (lower.includes('recovery') || lower.includes('spa') || lower.includes('sauna')) {
    return [
      { key: 'recovery', label: 'Recovery Activity', completed: false },
      { key: 'mobility', label: 'Mobility', completed: false },
      { key: 'sleep', label: 'Sleep', completed: false },
    ];
  }
  // Workout days: lower body, upper body, assessment, full body, conditioning, ruck, aerobic
  return [
    { key: 'workout', label: 'Workout', completed: false },
    { key: 'mobility', label: 'Mobility', completed: false },
    { key: 'sleep', label: 'Sleep', completed: false },
  ];
}

/**
 * Map session type strings to MUI color palette keys.
 */
function getSessionColor(sessionType: string): {
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
} {
  const lower = sessionType.toLowerCase();

  if (lower.includes('recovery flush') || lower === 'recovery')
    return { color: 'info' };
  if (lower.includes('spa') || lower.includes('sauna'))
    return { color: 'secondary' };
  if (lower.includes('assessment'))
    return { color: 'warning' };
  if (lower.includes('lower body') || lower.includes('upper body'))
    return { color: 'primary' };
  if (lower.includes('family'))
    return { color: 'success' };
  if (lower.includes('ruck') || lower.includes('long aerobic') || lower.includes('aerobic'))
    return { color: 'success' };
  if (lower.includes('rest'))
    return { color: 'default' };

  return { color: 'primary' };
}

/**
 * Check if a session is a rest or family day (no workout parsing needed).
 */
function isRestOrFamilyDay(sessionType: string): boolean {
  const lower = sessionType.toLowerCase();
  return lower === 'rest' || lower.includes('rest day') || lower.includes('family');
}

export default function TrainingPlanTable({
  items,
  readOnly = false,
  onUpdateSubTasks,
  onUpdateNotes,
}: TrainingPlanTableProps) {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [notes, setNotes] = useState<Record<number, string>>({});

  // Sync notes state when items prop changes
  React.useEffect(() => {
    const map: Record<number, string> = {};
    for (const item of items) {
      if (item.id != null) map[item.id] = item.athleteNotes;
    }
    setNotes(map);
  }, [items]);

  // Compute completion from sub-tasks
  const getEffectiveSubTasks = (item: PlanItem): SubTask[] => {
    if (item.subTasks && item.subTasks.length > 0) return item.subTasks;
    return generateDefaultSubTasks(item.sessionType);
  };

  const completedCount = items.filter((item) => {
    const st = getEffectiveSubTasks(item);
    return st.length > 0 && st.every((s) => s.completed);
  }).length;
  const total = items.length;
  const progress = total > 0 ? (completedCount / total) * 100 : 0;

  const handleNoteBlur = (id: number) => {
    if (onUpdateNotes && notes[id] !== undefined) {
      onUpdateNotes(id, notes[id]);
    }
  };

  const toggleExpanded = (id: number) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSubTaskToggle = (item: PlanItem, taskKey: string) => {
    if (readOnly || item.id == null || !onUpdateSubTasks) return;
    const current = getEffectiveSubTasks(item);
    const updated = current.map((st) =>
      st.key === taskKey ? { ...st, completed: !st.completed } : st
    );
    onUpdateSubTasks(item.id, updated);
  };

  return (
    <Box>
      {/* Progress header — serves as page title */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6">Training Plan</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              {completedCount} of {total} complete
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            aria-label={`Training plan progress: ${completedCount} of ${total} complete`}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                borderRadius: 4,
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Day cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {items.map((item) => {
          const sessionStyle = getSessionColor(item.sessionType);
          const isExpanded = expandedCards.has(item.id ?? item.dayOrder);
          const hasCoachCues = item.coachCues && item.coachCues.trim().length > 0;
          const hasNotes = item.athleteNotes && item.athleteNotes.trim().length > 0;
          const hasExpandableContent = hasCoachCues || hasNotes || !readOnly;
          const hasStartingWeight = item.startingWeight && item.startingWeight !== 'N/A' && item.startingWeight.trim() !== '';
          const isSimpleDay = isRestOrFamilyDay(item.sessionType);

          const subTasks = getEffectiveSubTasks(item);
          const allDone = subTasks.length > 0 && subTasks.every((s) => s.completed);
          const someDone = subTasks.some((s) => s.completed);

          // Get first sentence of coach cues for preview
          const cuePreview = hasCoachCues && !isExpanded
            ? item.coachCues.split(/[.\n]/)[0].trim()
            : null;

          return (
            <Card
              key={item.id ?? item.dayOrder}
              variant="outlined"
              sx={{
                transition: 'all 0.2s ease',
                ...(allDone && {
                  bgcolor: (theme) => alpha(theme.palette.success.main, 0.08),
                  borderColor: (theme) => alpha(theme.palette.success.main, 0.3),
                }),
                ...(!allDone && {
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 1,
                  },
                }),
              }}
            >
              <CardContent sx={{ pb: '12px !important', pt: 1.5 }}>
                {/* Header row: Day + Session Type Chip + Focus + Sub-tasks + Starting Weight + Status */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                  {allDone && (
                    <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
                  )}

                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      minWidth: 90,
                      ...(allDone && { color: 'text.secondary' }),
                    }}
                  >
                    {item.day}
                  </Typography>

                  <Chip
                    label={item.sessionType}
                    size="small"
                    color={sessionStyle.color}
                    variant={allDone ? 'outlined' : 'filled'}
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      ...(allDone && {
                        textDecoration: 'line-through',
                      }),
                    }}
                  />

                  {item.focus && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        fontStyle: 'italic',
                        ...(allDone && { textDecoration: 'line-through' }),
                      }}
                    >
                      {item.focus}
                    </Typography>
                  )}

                  {/* Sub-task pills — compact inline */}
                  {subTasks.map((st) => (
                    <Chip
                      key={st.key}
                      label={st.label}
                      size="small"
                      role={readOnly ? undefined : 'checkbox'}
                      aria-checked={readOnly ? undefined : st.completed}
                      aria-label={readOnly ? undefined : `Mark ${st.label} as ${st.completed ? 'incomplete' : 'complete'}`}
                      icon={st.completed ? <CheckIcon sx={{ fontSize: '14px !important' }} /> : undefined}
                      color={st.completed ? 'success' : 'default'}
                      variant={st.completed ? 'filled' : 'outlined'}
                      onClick={readOnly ? undefined : () => handleSubTaskToggle(item, st.key)}
                      sx={{
                        fontSize: '0.65rem',
                        height: 22,
                        fontWeight: 600,
                        cursor: readOnly ? 'default' : 'pointer',
                        ...(st.completed && { textDecoration: 'none' }),
                      }}
                    />
                  ))}

                  {someDone && !allDone && (
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      {subTasks.filter((s) => s.completed).length}/{subTasks.length}
                    </Typography>
                  )}

                  {hasStartingWeight && (
                    <Chip
                      icon={<FitnessCenterIcon sx={{ fontSize: 14 }} />}
                      label={item.startingWeight}
                      size="small"
                      variant="outlined"
                      sx={{ ml: 'auto', fontSize: '0.7rem', height: 24 }}
                    />
                  )}

                  {/* Expand button */}
                  {hasExpandableContent && (
                    <IconButton
                      size="small"
                      aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(item.id ?? item.dayOrder)}
                      sx={{ ml: hasStartingWeight ? 0 : 'auto' }}
                    >
                      {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  )}
                </Box>

                {/* Coach cues preview (collapsed) */}
                {cuePreview && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleExpanded(item.id ?? item.dayOrder)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpanded(item.id ?? item.dayOrder);
                      }
                    }}
                    sx={{
                      fontStyle: 'italic',
                      fontSize: '0.8rem',
                      pl: allDone ? 3.5 : 0,
                      mb: 0.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      '&:hover': { color: 'text.primary' },
                    }}
                  >
                    {cuePreview}
                  </Typography>
                )}

                {/* Workout plan — structured display or simple text for rest/family */}
                {item.workoutPlan && (
                  <Box
                    sx={{
                      pl: allDone ? 3.5 : 0,
                      pr: 1,
                    }}
                  >
                    {isSimpleDay ? (
                      <Typography variant="body2" color="text.secondary" sx={{ ...(allDone && { opacity: 0.7 }) }}>
                        {item.workoutPlan}
                      </Typography>
                    ) : (
                      <WorkoutDisplay content={item.workoutPlan} dimmed={allDone} />
                    )}
                  </Box>
                )}

                {/* Expandable section: Coach's Cues + Notes */}
                {hasExpandableContent && (
                  <Collapse in={isExpanded}>
                    <Box
                      sx={{
                        pl: allDone ? 3.5 : 0,
                        pr: 1,
                        pt: 1.5,
                        mt: 1,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      {hasCoachCues && (
                        <Box sx={{ mb: 2 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: 0.5,
                              color: 'text.secondary',
                              display: 'block',
                              mb: 0.5,
                            }}
                          >
                            Coach&apos;s Cues &amp; Mobility
                          </Typography>
                          <Box sx={{ fontSize: '0.875rem' }}>
                            <MarkdownRenderer content={item.coachCues} />
                          </Box>
                        </Box>
                      )}

                      {!readOnly && item.id != null ? (
                        <TextField
                          label="My Notes"
                          multiline
                          rows={2}
                          fullWidth
                          size="small"
                          value={notes[item.id] ?? ''}
                          onChange={(e) =>
                            setNotes((prev) => ({ ...prev, [item.id!]: e.target.value }))
                          }
                          onBlur={() => handleNoteBlur(item.id!)}
                          sx={{ mb: 1 }}
                        />
                      ) : (
                        hasNotes && (
                          <Box sx={{ mb: 1 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: 0.5,
                                color: 'text.secondary',
                                display: 'block',
                                mb: 0.5,
                              }}
                            >
                              My Notes
                            </Typography>
                            <Typography variant="body2">{item.athleteNotes}</Typography>
                          </Box>
                        )
                      )}
                    </Box>
                  </Collapse>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}
