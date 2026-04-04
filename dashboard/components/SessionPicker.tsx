'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Link from 'next/link';
import { borders, typography as designTypo } from '@/lib/design-tokens';

export interface UncompletedSession {
  id: number;
  day: string;
  session_type: string;
  focus: string;
  workout_plan?: string | null;
}

interface PlanExercise {
  name: string;
  section: string;
  sets: number | null;
  reps: string | null;
  weightKg: number | null;
  durationSeconds: number | null;
  type: string;
  supersetGroup: string | null;
  coachCue: string | null;
}

export interface PlannedSession {
  id?: number;
  session_type: string;
  focus: string;
  workout_plan?: string;
  exercises?: PlanExercise[];
}

export interface SessionPickerProps {
  date: string;
  plannedSession: PlannedSession | null;
  sessionsCompleted: number;
  sessionsPlanned: number;
  isFamilyDay?: boolean;
  sessionCompleted: boolean;
  sessionLogId: number | null;
  compliancePct: number | null;
  onSwap: () => void;
  onMarkFamilyDone?: () => void;
}

// Group exercises by section for display
function groupBySection(exercises: PlanExercise[]): Map<string, PlanExercise[]> {
  const map = new Map<string, PlanExercise[]>();
  for (const ex of exercises) {
    const section = ex.section || 'main_work';
    if (!map.has(section)) map.set(section, []);
    map.get(section)!.push(ex);
  }
  return map;
}

const SECTION_LABELS: Record<string, string> = {
  warm_up: 'WARM-UP',
  activation: 'ACTIVATION',
  main_work: 'MAIN WORK',
  accessory: 'ACCESSORY',
  finisher: 'FINISHER',
  cool_down: 'COOL-DOWN',
};

function formatRx(ex: PlanExercise): string {
  const parts: string[] = [];
  if (ex.sets) parts.push(`${ex.sets}`);
  if (ex.reps) parts.push(`×${ex.reps}`);
  if (ex.durationSeconds) {
    const dur = ex.durationSeconds >= 60
      ? `${Math.round(ex.durationSeconds / 60)}min`
      : `${ex.durationSeconds}s`;
    parts.push(dur);
  }
  if (ex.weightKg != null && ex.weightKg > 0) parts.push(`@ ${ex.weightKg}kg`);
  return parts.join(' ') || '';
}

export default function SessionPicker({
  date,
  plannedSession,
  sessionsCompleted,
  sessionsPlanned,
  isFamilyDay = false,
  sessionCompleted,
  sessionLogId,
  compliancePct,
  onSwap,
  onMarkFamilyDone,
}: SessionPickerProps) {
  const [expanded, setExpanded] = useState(false);

  const completionChip = sessionsPlanned > 0 ? (
    <Chip
      label={`${sessionsCompleted}/${sessionsPlanned}`}
      size="small"
      variant="outlined"
      sx={{
        fontWeight: 700,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '0.75rem',
        borderColor: sessionsCompleted >= sessionsPlanned ? '#22c55e' : borders.soft,
        color: sessionsCompleted >= sessionsPlanned ? '#16a34a' : '#71717a',
        borderRadius: 0,
      }}
    />
  ) : null;

  // Family day or no session planned — show simple card with optional "Mark Done"
  if (isFamilyDay || !plannedSession) {
    const label = isFamilyDay ? 'FAMILY DAY' : 'REST DAY';
    return (
      <Card variant="outlined">
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: isFamilyDay && !sessionCompleted ? 1.5 : 0 }}>
            <Typography sx={{ ...designTypo.categoryLabel }}>
              {label}
            </Typography>
            {completionChip}
          </Box>
          {isFamilyDay && sessionCompleted && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1 }}>
              <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 18 }} />
              <Typography sx={{ color: '#22c55e', fontWeight: 700, fontSize: '0.8125rem', fontFamily: '"JetBrains Mono", monospace' }}>
                DONE
              </Typography>
            </Box>
          )}
          {isFamilyDay && !sessionCompleted && onMarkFamilyDone && (
            <Box
              onClick={onMarkFamilyDone}
              sx={{
                border: `2px solid ${borders.hard}`,
                py: 1,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#18181b08' },
              }}
            >
              <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Mark Family Day Done
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  }

  const exercises = plannedSession.exercises ?? [];
  const sectionGroups = groupBySection(exercises);
  const hasExercises = exercises.length > 0;

  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography sx={{ ...designTypo.categoryLabel }}>
            {"TODAY'S SESSION"}
          </Typography>
          {completionChip}
        </Box>

        {/* Session name — clickable to expand exercises */}
        <Box
          onClick={() => hasExercises && setExpanded((v) => !v)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            cursor: hasExercises ? 'pointer' : 'default',
            mb: 1,
          }}
        >
          <Typography sx={{
            fontFamily: '"Libre Franklin", sans-serif',
            fontWeight: 800,
            fontSize: '1.125rem',
            textTransform: 'uppercase',
            letterSpacing: '-0.3px',
            flex: 1,
          }}>
            {plannedSession.focus}
          </Typography>
          {hasExercises && (
            expanded ? <ExpandLessIcon sx={{ color: '#71717a' }} /> : <ExpandMoreIcon sx={{ color: '#71717a' }} />
          )}
        </Box>

        {/* Status indicator */}
        {sessionCompleted && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
            <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 18 }} />
            <Typography sx={{ color: '#22c55e', fontWeight: 700, fontSize: '0.8125rem', fontFamily: '"JetBrains Mono", monospace' }}>
              COMPLETED{compliancePct != null && compliancePct < 100 ? ` · ${compliancePct}%` : ''}
            </Typography>
          </Box>
        )}

        {/* Expandable exercise list */}
        {hasExercises && (
          <Collapse in={expanded}>
            <Box sx={{ mt: 1, mb: 1.5, borderTop: `1px solid ${borders.soft}`, pt: 1.5 }}>
              {Array.from(sectionGroups.entries()).map(([section, exs]) => (
                <Box key={section} sx={{ mb: 1.5 }}>
                  <Typography sx={{
                    ...designTypo.categoryLabel,
                    fontSize: '0.5rem',
                    mb: 0.75,
                  }}>
                    {SECTION_LABELS[section] ?? section.toUpperCase()}
                  </Typography>
                  {exs.map((ex, i) => (
                    <Box key={i} sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5, pl: 0.5 }}>
                      {ex.supersetGroup && (
                        <Typography sx={{ fontSize: '0.625rem', fontWeight: 700, color: '#7c3aed', fontFamily: '"JetBrains Mono", monospace' }}>
                          {ex.supersetGroup}
                        </Typography>
                      )}
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, fontFamily: '"Libre Franklin", sans-serif', textTransform: 'uppercase', flex: 1 }}>
                        {ex.name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: '#71717a', fontFamily: '"JetBrains Mono", monospace', whiteSpace: 'nowrap' }}>
                        {formatRx(ex)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Collapse>
        )}

        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
          {sessionCompleted ? (
            <Link href={`/session?edit=true&sessionLogId=${sessionLogId}`} style={{ textDecoration: 'none', flex: 1 }}>
              <Box sx={{
                border: `2px solid ${borders.hard}`,
                py: 1,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#18181b08' },
              }}>
                <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Edit Session →
                </Typography>
              </Box>
            </Link>
          ) : (
            <Link href={plannedSession.id ? `/session?planItemId=${plannedSession.id}` : '/session'} style={{ textDecoration: 'none', flex: 1 }}>
              <Box sx={{
                bgcolor: borders.hard,
                color: '#fafaf7',
                py: 1,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#3f3f46' },
              }}>
                <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'inherit' }}>
                  Start Session →
                </Typography>
              </Box>
            </Link>
          )}
          {!sessionCompleted && (
            <Box
              onClick={onSwap}
              sx={{
                border: `2px solid ${borders.hard}`,
                py: 1,
                px: 2,
                textAlign: 'center',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#18181b08' },
              }}
            >
              <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Swap
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
