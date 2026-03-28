'use client';

import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent,
  Chip, Collapse, IconButton,
} from '@mui/material';
import { cardContentSx } from '@/lib/theme';
import { semanticColors, typography } from '@/lib/design-tokens';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import type { PlanItem } from '@/lib/types';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import WorkoutDisplay from '@/components/WorkoutDisplay';

interface TrainingPlanTableProps {
  items: PlanItem[];
}

/**
 * Map session type strings to semantic color hex values.
 * Returns background and text colors for use with sx prop.
 */
function getSessionChipSx(sessionType: string): { bgcolor: string; color: string } | null {
  const lower = sessionType.toLowerCase();

  if (lower.includes('rest'))
    return null; // default chip styling

  if (lower.includes('lower body') || lower.includes('upper body') || lower.includes('strength'))
    return {
      bgcolor: `${semanticColors.body}22`,
      color: semanticColors.body,
    };

  if (lower.includes('recovery') || lower.includes('mobility') || lower.includes('spa') || lower.includes('sauna'))
    return {
      bgcolor: `${semanticColors.cardioSteady}22`,
      color: semanticColors.cardioSteady,
    };

  if (lower.includes('cardio') || lower.includes('interval') || lower.includes('assessment'))
    return {
      bgcolor: `${semanticColors.cardioIntervals}22`,
      color: semanticColors.cardioIntervals,
    };

  if (lower.includes('family') || lower.includes('ruck') || lower.includes('aerobic'))
    return {
      bgcolor: `${semanticColors.recovery.good}22`,
      color: semanticColors.recovery.good,
    };

  // Default: body color for any other training session
  return {
    bgcolor: `${semanticColors.body}22`,
    color: semanticColors.body,
  };
}

/**
 * Check if a session is a rest or family day (no workout parsing needed).
 */
function isRestOrFamilyDay(sessionType: string): boolean {
  const lower = sessionType.toLowerCase();
  return lower === 'rest' || lower.includes('rest day') || lower.includes('family');
}

export default function TrainingPlanTable({ items }: TrainingPlanTableProps) {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

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

  return (
    <Box>
      {/* Header */}
      <Card sx={{ mb: 2 }}>
        <CardContent sx={cardContentSx}>
          <Typography sx={typography.sectionTitle}>Training Plan</Typography>
        </CardContent>
      </Card>

      {/* Day cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((item) => {
          const chipSx = getSessionChipSx(item.sessionType);
          const isExpanded = expandedCards.has(item.id ?? item.dayOrder);
          const hasCoachCues = item.coachCues && item.coachCues.trim().length > 0;
          const hasStartingWeight = item.startingWeight && item.startingWeight !== 'N/A' && item.startingWeight.trim() !== '';
          const isSimpleDay = isRestOrFamilyDay(item.sessionType);

          return (
            <Card
              key={item.id ?? item.dayOrder}
              variant="outlined"
              sx={{
                transition: 'all 0.2s ease',
                ...(item.status === 'completed' && {
                  borderLeft: `4px solid ${semanticColors.recovery.good}`,
                }),
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: 1,
                },
              }}
            >
              <CardContent sx={cardContentSx}>
                {/* Row 1: Day + Session Type + Starting Weight + Expand */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography sx={{ ...typography.categoryLabel }}>
                    {item.day}
                  </Typography>

                  <Chip
                    label={item.sessionType}
                    size="small"
                    variant="filled"
                    sx={{
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      ...(chipSx
                        ? { bgcolor: chipSx.bgcolor, color: chipSx.color }
                        : {}),
                    }}
                  />

                  {item.status === 'completed' && (
                    <Chip
                      label="Completed"
                      size="small"
                      sx={{
                        bgcolor: `${semanticColors.recovery.good}22`,
                        color: semanticColors.recovery.good,
                        fontWeight: 600,
                        fontSize: '0.6875rem',
                        height: 22,
                      }}
                    />
                  )}

                  {/* Start/Review Session link — shown for all non-rest days */}
                  {!isSimpleDay && item.id != null && (
                    <Typography
                      component="a"
                      href={
                        item.status === 'completed' && (item as unknown as Record<string, unknown>).sessionLogId
                          ? `/session?edit=true&sessionLogId=${(item as unknown as Record<string, unknown>).sessionLogId}`
                          : `/session?planItemId=${item.id}`
                      }
                      sx={{
                        ml: 'auto',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: item.status === 'completed' ? semanticColors.recovery.good : semanticColors.body,
                        textDecoration: 'none',
                        whiteSpace: 'nowrap',
                        '&:hover': { textDecoration: 'underline' },
                      }}
                    >
                      {item.status === 'completed' ? 'Review Session →' : 'Start Session →'}
                    </Typography>
                  )}

                  {hasStartingWeight && (
                    <Chip
                      icon={<FitnessCenterIcon sx={{ fontSize: 14 }} />}
                      label={item.startingWeight}
                      size="small"
                      variant="outlined"
                      sx={{ ml: isSimpleDay ? 'auto' : 0, fontSize: '0.7rem', height: 24 }}
                    />
                  )}

                  {/* Expand button */}
                  {hasCoachCues && (
                    <IconButton
                      size="small"
                      aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(item.id ?? item.dayOrder)}
                      sx={{
                        ml: 0,
                        '&:focus-visible': {
                          outline: '2px solid',
                          outlineColor: 'primary.main',
                          outlineOffset: 2,
                        },
                      }}
                    >
                      {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  )}
                </Box>

                {/* Row 2: Focus */}
                {item.focus && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontStyle: 'italic', mb: 1 }}
                  >
                    {item.focus}
                  </Typography>
                )}

                {/* Workout plan — structured display or simple text for rest/family */}
                {item.workoutPlan && (
                  <Box sx={{ pr: 1 }}>
                    {isSimpleDay ? (
                      <Typography variant="body2" color="text.secondary">
                        {item.workoutPlan}
                      </Typography>
                    ) : (
                      <WorkoutDisplay content={item.workoutPlan} dimmed={false} />
                    )}
                  </Box>
                )}

                {/* Expandable section: Coach's Cues */}
                {hasCoachCues && (
                  <Collapse in={isExpanded}>
                    <Box
                      sx={{
                        pr: 1,
                        pt: 1.5,
                        mt: 1,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
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
