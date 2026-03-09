'use client';

import React, { useState } from 'react';
import {
  Box, Typography, LinearProgress, Card, CardContent,
  Checkbox, Chip, Collapse, TextField, IconButton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import type { PlanItem } from '@/lib/types';
import MarkdownRenderer from '@/components/MarkdownRenderer';

interface TrainingPlanTableProps {
  items: PlanItem[];
  readOnly?: boolean;
  onToggleComplete?: (id: number, completed: boolean) => void;
  onUpdateNotes?: (id: number, notes: string) => void;
}

/**
 * Map session type strings to MUI color palette keys + a custom family green.
 */
function getSessionColor(sessionType: string): {
  color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
  custom?: string;
  bg?: string;
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
    return { color: 'success', custom: '#e8f5e9', bg: '#f1f8e9' };
  if (lower.includes('ruck') || lower.includes('long aerobic') || lower.includes('aerobic'))
    return { color: 'success' };
  if (lower.includes('rest'))
    return { color: 'default' };

  // Fallback for anything else (e.g. "Full Body", "Conditioning", etc.)
  return { color: 'primary' };
}

export default function TrainingPlanTable({
  items,
  readOnly = false,
  onToggleComplete,
  onUpdateNotes,
}: TrainingPlanTableProps) {
  const [expandedCards, setExpandedCards] = useState<Set<number | undefined>>(new Set());
  const [notes, setNotes] = useState<Record<number, string>>({});

  // Sync notes state when items prop changes
  React.useEffect(() => {
    const map: Record<number, string> = {};
    for (const item of items) {
      if (item.id != null) map[item.id] = item.athleteNotes;
    }
    setNotes(map);
  }, [items]);

  const completed = items.filter((i) => i.completed).length;
  const total = items.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  const handleNoteBlur = (id: number) => {
    if (onUpdateNotes && notes[id] !== undefined) {
      onUpdateNotes(id, notes[id]);
    }
  };

  const toggleExpanded = (id: number | undefined) => {
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

  return (
    <Box>
      {/* Progress header */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ pb: '16px !important' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6">Training Plan</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              {completed} of {total} complete
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
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

          return (
            <Card
              key={item.id ?? item.dayOrder}
              variant="outlined"
              sx={{
                transition: 'all 0.2s ease',
                ...(item.completed && {
                  bgcolor: 'rgba(76, 175, 80, 0.06)',
                  borderColor: 'rgba(76, 175, 80, 0.3)',
                }),
                ...(!item.completed && {
                  '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 1,
                  },
                }),
              }}
            >
              <CardContent sx={{ pb: '12px !important', pt: 1.5 }}>
                {/* Header row: Checkbox + Day + Session Type Chip + Focus + Starting Weight */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Checkbox
                    checked={item.completed}
                    disabled={readOnly}
                    size="small"
                    sx={{
                      p: 0.5,
                      color: item.completed ? 'success.main' : undefined,
                      '&.Mui-checked': { color: 'success.main' },
                    }}
                    onChange={() => {
                      if (onToggleComplete && item.id != null) {
                        onToggleComplete(item.id, !item.completed);
                      }
                    }}
                  />

                  <Typography
                    variant="subtitle1"
                    sx={{
                      fontWeight: 700,
                      minWidth: 90,
                      ...(item.completed && { color: 'text.secondary' }),
                    }}
                  >
                    {item.day}
                  </Typography>

                  <Chip
                    label={item.sessionType}
                    size="small"
                    color={sessionStyle.color}
                    variant={item.completed ? 'outlined' : 'filled'}
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      ...(sessionStyle.custom && !item.completed && {
                        bgcolor: sessionStyle.custom,
                        color: '#2e7d32',
                      }),
                      ...(item.completed && {
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
                        ...(item.completed && { textDecoration: 'line-through' }),
                      }}
                    >
                      {item.focus}
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

                  {/* Expand button — only show if there's expandable content */}
                  {hasExpandableContent && (
                    <IconButton
                      size="small"
                      onClick={() => toggleExpanded(item.id ?? item.dayOrder)}
                      sx={{ ml: hasStartingWeight ? 0 : 'auto' }}
                    >
                      {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  )}
                </Box>

                {/* Workout plan — ALWAYS fully visible, never truncated */}
                {item.workoutPlan && (
                  <Box
                    sx={{
                      pl: 4.5,
                      pr: 1,
                      ...(item.completed && { opacity: 0.7 }),
                    }}
                  >
                    <MarkdownRenderer content={item.workoutPlan} />
                  </Box>
                )}

                {/* Expandable section: Coach's Cues + Notes */}
                {hasExpandableContent && (
                  <Collapse in={isExpanded}>
                    <Box
                      sx={{
                        pl: 4.5,
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
