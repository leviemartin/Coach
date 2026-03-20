'use client';

import React, { useState } from 'react';
import {
  Box, Typography, Card, CardContent,
  Chip, Collapse, IconButton,
} from '@mui/material';
import { cardContentSx } from '@/lib/theme';
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
          <Typography variant="h6">Training Plan</Typography>
        </CardContent>
      </Card>

      {/* Day cards */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((item) => {
          const sessionStyle = getSessionColor(item.sessionType);
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
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: 1,
                },
              }}
            >
              <CardContent sx={cardContentSx}>
                {/* Row 1: Day + Session Type + Starting Weight + Expand */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                    {item.day}
                  </Typography>

                  <Chip
                    label={item.sessionType}
                    size="small"
                    color={sessionStyle.color}
                    variant="filled"
                    sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                  />

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
                  {hasCoachCues && (
                    <IconButton
                      size="small"
                      aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                      aria-expanded={isExpanded}
                      onClick={() => toggleExpanded(item.id ?? item.dayOrder)}
                      sx={{
                        ml: hasStartingWeight ? 0 : 'auto',
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
