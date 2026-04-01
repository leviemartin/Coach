'use client';
import React, { useState } from 'react';
import { Box, Typography, Collapse } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import type { PlanItem, PlanExercise, ExerciseBlock, Section } from '@/lib/types';
import { buildBlocksFromPlan } from '@/lib/buildBlocks';
import { statusColors } from '@/lib/design-tokens';
import { formatDuration } from '@/lib/format';
import SectionDivider from './SectionDivider';
import ExerciseRowPlan from './ExerciseRowPlan';
import CardioCardPlan from './CardioCardPlan';
import SupersetBlockPlan from './SupersetBlockPlan';
import WarmupCheckbox from './WarmupCheckbox';

interface PlanDayCardProps {
  item: PlanItem;
  exercises: PlanExercise[];
  status: 'draft' | 'published' | 'completed' | 'skipped';
  defaultExpanded?: boolean;
  onStartSession?: () => void;
  onSwapDay?: () => void;
}

const SESSION_TYPE_COLORS: Record<string, { border: string; color: string; bg: string }> = {
  strength:           { border: '#3b82f640', color: '#2563eb', bg: '#3b82f610' },
  upper_push:         { border: '#3b82f640', color: '#2563eb', bg: '#3b82f610' },
  upper_pull:         { border: '#3b82f640', color: '#2563eb', bg: '#3b82f610' },
  lower_push:         { border: '#3b82f640', color: '#2563eb', bg: '#3b82f610' },
  lower_pull:         { border: '#3b82f640', color: '#2563eb', bg: '#3b82f610' },
  full_body:          { border: '#3b82f640', color: '#2563eb', bg: '#3b82f610' },
  hypertrophy:        { border: '#3b82f640', color: '#2563eb', bg: '#3b82f610' },
  conditioning:       { border: '#f9731640', color: '#ea580c', bg: '#f9731610' },
  steady_state_cardio:{ border: '#14b8a640', color: '#0d9488', bg: '#14b8a610' },
  interval_cardio:    { border: '#f9731640', color: '#ea580c', bg: '#f9731610' },
  recovery:           { border: '#8b5cf640', color: '#7c3aed', bg: '#8b5cf610' },
  active_recovery:    { border: '#8b5cf640', color: '#7c3aed', bg: '#8b5cf610' },
  mobility:           { border: '#8b5cf640', color: '#7c3aed', bg: '#8b5cf610' },
  rest:               { border: '#a1a1aa40', color: '#71717a', bg: '#a1a1aa10' },
  hybrid:             { border: '#f59e0b40', color: '#d97706', bg: '#f59e0b10' },
  sport_specific:     { border: '#dc262640', color: '#dc2626', bg: '#dc262610' },
};

function getSessionTypeColors(sessionType: string) {
  const key = sessionType.toLowerCase().replace(/\s+/g, '_');
  return SESSION_TYPE_COLORS[key] ?? { border: '#a1a1aa40', color: '#71717a', bg: '#a1a1aa10' };
}

function isRestOrFamily(item: PlanItem): boolean {
  const t = item.sessionType.toLowerCase();
  return t.includes('rest') || t.includes('family');
}

function getSectionLabel(section: Section): string {
  const SECTION_LABELS: Record<string, string> = {
    warm_up: 'WARM-UP', activation: 'ACTIVATION', main_work: 'MAIN WORK',
    accessory: 'ACCESSORY', finisher: 'FINISHER', cool_down: 'COOL-DOWN',
  };
  return SECTION_LABELS[section] ?? section.toUpperCase().replace('_', ' ');
}

function getWarmupDetail(block: ExerciseBlock): string {
  if (block.kind === 'cardio') {
    const parts: string[] = [];
    if (block.exercise.prescribedRounds) parts.push(`${block.exercise.prescribedRounds}×`);
    if (block.exercise.prescribedDurationMin) parts.push(`${block.exercise.prescribedDurationMin} min`);
    if (block.exercise.intervalWorkSeconds != null) parts.push(`${block.exercise.intervalWorkSeconds}s on`);
    return parts.join(' · ') || '—';
  }
  if (block.kind === 'single') {
    const ex = block.exercise;
    const parts: string[] = [];
    if (ex.sets) parts.push(`${ex.sets}×`);
    if (ex.prescribedRepsDisplay) parts.push(ex.prescribedRepsDisplay);
    else if (ex.prescribedDurationS) parts.push(formatDuration(ex.prescribedDurationS));
    return parts.join(' ') || '—';
  }
  return '—';
}

export default function PlanDayCard({
  item,
  exercises,
  status,
  defaultExpanded = false,
  onStartSession,
  onSwapDay,
}: PlanDayCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isRest = isRestOrFamily(item);
  const typeColors = getSessionTypeColors(item.sessionType);
  const statusStyle = statusColors[status] ?? statusColors.draft;

  const blocks = buildBlocksFromPlan(exercises);
  const exerciseCount = blocks.length;
  const hasStructured = exercises.length > 0;

  // Track which sections we've already rendered dividers for
  function renderBlocks() {
    const rendered: React.ReactNode[] = [];
    let lastSection: string | null = null;
    // Counter per section for exercise labels (A1, B1, etc.)
    const sectionCounters: Record<string, number> = {};

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const isWarmupSection = block.section === 'warm_up' || block.section === 'cool_down';

      // Section divider on section change
      if (block.section !== lastSection) {
        rendered.push(<SectionDivider key={`divider-${block.section}-${i}`} section={block.section} />);
        lastSection = block.section;
      }

      if (block.kind === 'superset') {
        rendered.push(
          <SupersetBlockPlan
            key={`ss-${block.groupId}-${block.section}`}
            groupId={block.groupId}
            exercises={block.exercises}
            restSeconds={block.restSeconds}
          />
        );
      } else if (block.kind === 'cardio') {
        if (isWarmupSection) {
          const detail = getWarmupDetail(block);
          rendered.push(
            <WarmupCheckbox
              key={`warmup-cardio-${i}`}
              exerciseName={block.exercise.name}
              detail={detail}
              coachCue={block.exercise.coachCue}
              completed={false}
              interactive={false}
            />
          );
        } else {
          const sectionKey = block.section;
          sectionCounters[sectionKey] = (sectionCounters[sectionKey] ?? 0) + 1;
          const label = `${String.fromCharCode(64 + sectionCounters[sectionKey])}1`;
          rendered.push(
            <CardioCardPlan key={`cardio-${i}`} label={label} exercise={block.exercise} />
          );
        }
      } else {
        // single
        if (isWarmupSection) {
          const detail = getWarmupDetail(block);
          rendered.push(
            <WarmupCheckbox
              key={`warmup-${i}`}
              exerciseName={block.exercise.name}
              detail={detail}
              coachCue={block.exercise.coachCue}
              completed={false}
              interactive={false}
            />
          );
        } else {
          const sectionKey = block.section;
          sectionCounters[sectionKey] = (sectionCounters[sectionKey] ?? 0) + 1;
          const label = `${String.fromCharCode(64 + sectionCounters[sectionKey])}1`;
          rendered.push(
            <ExerciseRowPlan key={`ex-${i}`} label={label} exercise={block.exercise} />
          );
        }
      }
    }
    return rendered;
  }

  return (
    <Box sx={{ border: '3px solid #18181b', mb: 2, overflow: 'hidden' }}>
      {/* ── Header (clickable) ── */}
      <Box
        onClick={() => !isRest && setExpanded(!expanded)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
          cursor: isRest ? 'default' : 'pointer',
          '&:hover': isRest ? {} : { bgcolor: '#f5f5f2' },
        }}
      >
        {!isRest && (
          expanded
            ? <KeyboardArrowDownIcon sx={{ color: '#18181b', fontSize: 18 }} />
            : <KeyboardArrowRightIcon sx={{ color: '#18181b', fontSize: 18 }} />
        )}

        {/* Day name */}
        <Typography sx={{
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '0.875rem', fontWeight: 700, minWidth: 36, color: '#18181b',
        }}>
          {item.day.slice(0, 3).toUpperCase()}
        </Typography>

        {/* Session type badge */}
        <Box sx={{
          border: `1px solid ${typeColors.border}`,
          bgcolor: typeColors.bg,
          px: 0.75, py: 0.25,
          flexShrink: 0,
        }}>
          <Typography sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.625rem', fontWeight: 700, color: typeColors.color,
            letterSpacing: '1px', textTransform: 'uppercase',
          }}>
            {item.sessionType.replace(/_/g, ' ')}
          </Typography>
        </Box>

        {/* Status badge */}
        <Box sx={{
          border: `1px solid ${statusStyle.border}`,
          bgcolor: statusStyle.bg,
          px: 0.75, py: 0.25,
          flexShrink: 0,
        }}>
          <Typography sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.625rem', fontWeight: 700, color: statusStyle.color,
            letterSpacing: '1px', textTransform: 'uppercase',
          }}>
            {status}
          </Typography>
        </Box>
      </Box>

      {/* ── Session meta (always visible) ── */}
      {!isRest && (
        <Box sx={{ borderTop: '2px solid #18181b', px: 2.5, py: 1.25 }}>
          <Typography sx={{
            fontFamily: '"Libre Franklin", sans-serif',
            fontSize: '1rem', fontWeight: 900, color: '#18181b', lineHeight: 1.2,
          }}>
            {item.focus}
          </Typography>
          <Typography sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '0.6875rem', color: '#71717a', mt: 0.5,
          }}>
            {item.estimatedDurationMin ? `EST. ${item.estimatedDurationMin} MIN` : null}
            {item.estimatedDurationMin && exerciseCount > 0 ? ' · ' : null}
            {exerciseCount > 0 ? `${exerciseCount} EXERCISE${exerciseCount !== 1 ? 'S' : ''}` : null}
          </Typography>
        </Box>
      )}

      {/* ── Collapsible body ── */}
      <Collapse in={expanded}>
        <Box>
          {/* Exercise blocks */}
          {hasStructured ? (
            <Box sx={{ borderTop: '1px solid #e4e4e0' }}>
              {renderBlocks()}
            </Box>
          ) : item.workoutPlan ? (
            <Box sx={{ borderTop: '1px solid #e4e4e0', px: 2.5, py: 1.5 }}>
              <Typography sx={{ fontSize: '0.8125rem', color: '#334155', whiteSpace: 'pre-wrap' }}>
                {item.workoutPlan}
              </Typography>
            </Box>
          ) : null}

          {/* Coach cues */}
          {item.coachCues && (
            <Box sx={{
              borderTop: '1px solid #e4e4e0',
              px: 2.5, py: 1.25,
              bgcolor: '#fafaf7',
            }}>
              <Typography sx={{
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '2px',
                color: '#b45309', textTransform: 'uppercase', mb: 0.5,
              }}>
                Coach Cues
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.5 }}>
                {item.coachCues}
              </Typography>
            </Box>
          )}

          {/* Actions */}
          {(onStartSession || onSwapDay) && (
            <Box sx={{
              borderTop: '2px solid #18181b',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              px: 2, py: 1,
            }}>
              {onStartSession && (
                <Box
                  component="button"
                  onClick={onStartSession}
                  sx={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '0.6875rem', fontWeight: 700,
                    letterSpacing: '1.5px', textTransform: 'uppercase',
                    backgroundColor: '#18181b', color: '#fafaf7',
                    border: 'none', px: 1.5, py: 0.875,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: '#3f3f46' },
                  }}
                >
                  Start Session
                </Box>
              )}
              {onSwapDay && (
                <Box
                  component="button"
                  onClick={onSwapDay}
                  sx={{
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: '0.6875rem', fontWeight: 700,
                    letterSpacing: '1.5px', textTransform: 'uppercase',
                    backgroundColor: 'transparent', color: '#18181b',
                    border: '2px solid #18181b', px: 1.5, py: 0.875,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: '#f5f5f2' },
                  }}
                >
                  Swap Day
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
