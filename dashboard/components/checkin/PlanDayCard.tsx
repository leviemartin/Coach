'use client';

import React, { useState } from 'react';
import { Box, Typography, Chip, Collapse, Divider } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import type { PlanItem } from '@/lib/types';
import ExerciseBlock, { parseWorkoutPlan } from './ExerciseBlock';

// ─── Session type chip colors ─────────────────────────────────────────────────

interface ChipStyle { bg: string; text: string }

function getSessionChipStyle(sessionType: string): ChipStyle {
  const t = sessionType.toLowerCase();
  if (t.includes('strength')) return { bg: '#3b82f618', text: '#2563eb' };
  if (t.includes('cardio') || t.includes('endurance')) return { bg: '#f9731618', text: '#ea580c' };
  if (t.includes('recovery') || t.includes('active')) return { bg: '#8b5cf618', text: '#7c3aed' };
  if (t.includes('ruck') || t.includes('hike')) return { bg: '#14b8a618', text: '#0d9488' };
  if (t.includes('rest') || t.includes('family') || t.includes('off')) return { bg: '#a1a1aa18', text: '#71717a' };
  if (t.includes('mobility')) return { bg: '#f59e0b18', text: '#d97706' };
  return { bg: '#a1a1aa18', text: '#18181b' };
}

function isRestOrFamily(item: PlanItem): boolean {
  const combined = `${item.sessionType} ${item.focus}`.toLowerCase();
  return (
    combined.includes('rest') ||
    combined.includes('family') ||
    combined.includes('off day') ||
    (combined.trim() === '' && !item.workoutPlan?.trim())
  );
}

// ─── Day name/date parsing ────────────────────────────────────────────────────

function parseDayDisplay(day: string): { shortDay: string; dateStr: string } {
  // Handles "Monday", "Mon Mar 23", "Mon Mar 23, 2026"
  const parts = day.trim().split(/[\s,]+/);
  if (parts.length === 1) {
    return { shortDay: parts[0].slice(0, 3), dateStr: '' };
  }
  const shortDay = parts[0].slice(0, 3);
  const dateStr = parts.slice(1).join(' ');
  return { shortDay, dateStr };
}

// ─── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography sx={{
      fontSize: '0.6875rem',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '1px',
      color: '#71717a',
      mt: 2,
      mb: 0.5,
    }}>
      {children}
    </Typography>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PlanDayCardProps {
  item: PlanItem;
  defaultExpanded?: boolean;
}

export default function PlanDayCard({ item, defaultExpanded = false }: PlanDayCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isRest = isRestOrFamily(item);
  const { shortDay, dateStr } = parseDayDisplay(item.day);
  const chipStyle = getSessionChipStyle(item.sessionType);

  const groups = isRest ? [] : parseWorkoutPlan(item.workoutPlan || '');
  const warmupGroups = groups.filter(g => g.type === 'warmup');
  const cooldownGroups = groups.filter(g => g.type === 'cooldown');
  const cardioGroups = groups.filter(g => g.type === 'cardio');
  const exerciseGroups = groups.filter(g => g.type !== 'warmup' && g.type !== 'cooldown' && g.type !== 'cardio');

  if (isRest) {
    return (
      <Box sx={{
        bgcolor: '#ffffff',
        border: '1px solid #e4e4e0',
        borderRadius: 0,
        px: 2.5,
        py: 2,
        mb: 1.5,
        opacity: 0.6,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, minWidth: 40, color: '#18181b' }}>
            {shortDay}
          </Typography>
          {dateStr && (
            <Typography sx={{ fontSize: '0.75rem', color: '#71717a' }}>
              {dateStr}
            </Typography>
          )}
          <Chip
            label={item.sessionType || item.focus || 'Rest'}
            size="small"
            sx={{ bgcolor: '#a1a1aa18', color: '#71717a', fontWeight: 600, fontSize: '0.75rem', borderRadius: 0 }}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{
      bgcolor: '#ffffff',
      border: '1px solid',
      borderColor: expanded ? '#18181b' : '#e4e4e0',
      borderRadius: 0,
      mb: 1.5,
      overflow: 'hidden',
      transition: 'border-color 0.15s ease',
      '&:hover': { borderColor: '#18181b' },
    }}>
      {/* Header */}
      <Box
        onClick={() => setExpanded(v => !v)}
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2.5,
          py: 2,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {/* Left: day name, date, session type chip, focus */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
          <Box>
            <Box component="span" sx={{ fontSize: '0.9375rem', fontWeight: 700, color: '#18181b', mr: 1 }}>
              {shortDay}
            </Box>
            {dateStr && (
              <Box component="span" sx={{ fontSize: '0.75rem', color: '#71717a' }}>
                {dateStr}
              </Box>
            )}
          </Box>

          {item.sessionType && (
            <Chip
              label={item.sessionType}
              size="small"
              sx={{
                bgcolor: chipStyle.bg,
                color: chipStyle.text,
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 22,
                borderRadius: 0,
              }}
            />
          )}

          {item.focus && (
            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#18181b' }}>
              {item.focus}
            </Typography>
          )}
        </Box>

        {/* Right: sequence chip + expand arrow */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0, ml: 1 }}>
          {(item.sequenceOrder || item.sequenceNotes) && (
            <Box sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.25,
              borderRadius: 0,
              bgcolor: '#f0f0eb',
              color: '#71717a',
              border: '1px solid #e4e4e0',
              fontSize: '0.6875rem',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}>
              {item.sequenceOrder ? `Seq #${item.sequenceOrder}` : ''}
              {item.sequenceNotes ? (item.sequenceOrder ? ` · ${item.sequenceNotes}` : item.sequenceNotes) : ''}
            </Box>
          )}
          <Typography sx={{ fontSize: '0.75rem', color: '#71717a', display: 'flex', alignItems: 'center' }}>
            {expanded
              ? <><KeyboardArrowDownIcon sx={{ fontSize: 16 }} /> Details</>
              : <><KeyboardArrowRightIcon sx={{ fontSize: 16 }} /> Expand</>
            }
          </Typography>
        </Box>
      </Box>

      {/* Expanded body */}
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{
          borderTop: '1px solid #e4e4e0',
          bgcolor: '#fafaf7',
          px: 2.5,
          py: 2,
        }}>
          {/* Coach's Note */}
          {item.coachCues && item.coachCues.trim() && (
            <Box sx={{
              bgcolor: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 0,
              px: 1.75,
              py: 1.25,
              mb: 2,
            }}>
              <Typography sx={{ fontSize: '0.8125rem', color: '#92400e', lineHeight: 1.6 }}>
                <Box component="span" sx={{ fontWeight: 600 }}>{"Coach's Note: "}</Box>
                {item.coachCues}
              </Typography>
            </Box>
          )}

          {/* Starting weight hint */}
          {item.startingWeight && item.startingWeight.trim() && (
            <Typography sx={{ fontSize: '0.75rem', color: '#71717a', mb: 1 }}>
              Est. starting weight: <Box component="span" sx={{ fontWeight: 600, color: '#18181b' }}>{item.startingWeight}</Box>
            </Typography>
          )}

          {/* Warm-up */}
          {warmupGroups.length > 0 && (
            <Box>
              <SectionLabel>Warm-up</SectionLabel>
              {warmupGroups.map((g, i) => <ExerciseBlock key={`${g.type}-${g.letter || ''}-${i}`} group={g} />)}
            </Box>
          )}

          {/* Exercise blocks */}
          {exerciseGroups.length > 0 && (
            <Box>
              {exerciseGroups.map((g, i) => <ExerciseBlock key={`${g.type}-${g.letter || ''}-${i}`} group={g} />)}
            </Box>
          )}

          {/* Cardio */}
          {cardioGroups.length > 0 && (
            <Box>
              {cardioGroups.map((g, i) => <ExerciseBlock key={`${g.type}-${g.letter || ''}-${i}`} group={g} />)}
            </Box>
          )}

          {/* Cool-down */}
          {cooldownGroups.length > 0 && (
            <Box>
              <SectionLabel>Cool-down</SectionLabel>
              {cooldownGroups.map((g, i) => <ExerciseBlock key={`${g.type}-${g.letter || ''}-${i}`} group={g} />)}
            </Box>
          )}

          {/* Fallback: raw plan text if no groups parsed */}
          {groups.length === 0 && item.workoutPlan && item.workoutPlan.trim() && (
            <Typography sx={{
              fontSize: '0.8125rem',
              color: '#71717a',
              whiteSpace: 'pre-line',
              lineHeight: 1.7,
            }}>
              {item.workoutPlan}
            </Typography>
          )}

          {/* Sequence group note */}
          {item.sequenceGroup && (
            <Box sx={{ mt: 1.5 }}>
              <Divider sx={{ mb: 1.5 }} />
              <Typography sx={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
                Group: {item.sequenceGroup}
              </Typography>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
