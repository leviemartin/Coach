'use client';
import React, { useState } from 'react';
import { Box, Typography, Chip, Collapse, Button, Divider } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import type { PlanItem, PlanExercise } from '@/lib/types';
import SectionHeader from './SectionHeader';
import ExerciseRow from './ExerciseRow';
import SupersetBlock from './SupersetBlock';

interface PlanDayCardProps {
  item: PlanItem;
  exercises: PlanExercise[];
  defaultExpanded?: boolean;
  status: 'draft' | 'published' | 'completed' | 'skipped';
  onStartSession?: () => void;
  onSwapDay?: () => void;
}

const STATUS_CHIPS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#b45309', bg: '#fef3c7' },
  published: { label: 'Published', color: '#15803d', bg: '#dcfce7' },
  completed: { label: 'Completed', color: '#1d4ed8', bg: '#dbeafe' },
  skipped: { label: 'Skipped', color: '#64748b', bg: '#f1f5f9' },
};

function getSessionChipStyle(sessionType: string) {
  const t = sessionType.toLowerCase();
  if (t.includes('strength') || t.includes('upper') || t.includes('lower') || t.includes('full')) return { bg: '#dbeafe', text: '#1d4ed8' };
  if (t.includes('cardio') || t.includes('interval')) return { bg: '#ffedd5', text: '#c2410c' };
  if (t.includes('recovery') || t.includes('mobility')) return { bg: '#ede9fe', text: '#6d28d9' };
  if (t.includes('ruck') || t.includes('hike')) return { bg: '#ccfbf1', text: '#0f766e' };
  if (t.includes('rest') || t.includes('family')) return { bg: '#f1f5f9', text: '#475569' };
  return { bg: '#f1f5f9', text: '#0f172a' };
}

function isRestOrFamily(item: PlanItem): boolean {
  const t = item.sessionType.toLowerCase();
  return t.includes('rest') || t.includes('family');
}

export default function PlanDayCard({ item, exercises, defaultExpanded = false, status, onStartSession, onSwapDay }: PlanDayCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isRest = isRestOrFamily(item);
  const chipStyle = getSessionChipStyle(item.sessionType);
  const statusChip = STATUS_CHIPS[status];

  // Group exercises by section
  const sections = new Map<string, PlanExercise[]>();
  for (const ex of exercises) {
    const group = sections.get(ex.section) ?? [];
    group.push(ex);
    sections.set(ex.section, group);
  }

  const sectionOrder = ['warm_up', 'activation', 'main_work', 'accessory', 'finisher', 'cool_down'];

  function renderExercises(sectionExercises: PlanExercise[]) {
    const rendered: React.ReactNode[] = [];
    const seenGroups = new Set<string>();
    let standaloneLetterIndex = 0;

    for (const ex of sectionExercises) {
      if (ex.supersetGroup && !seenGroups.has(ex.supersetGroup)) {
        seenGroups.add(ex.supersetGroup);
        const grouped = sectionExercises.filter(e => e.supersetGroup === ex.supersetGroup);
        rendered.push(
          <SupersetBlock key={`ss-${ex.supersetGroup}`} groupLetter={ex.supersetGroup} exercises={grouped} />
        );
      } else if (!ex.supersetGroup) {
        // Find the next available letter that isn't used by a superset group
        let letter: string;
        do {
          letter = String.fromCharCode(65 + standaloneLetterIndex);
          standaloneLetterIndex++;
        } while (seenGroups.has(letter));

        rendered.push(
          <ExerciseRow key={ex.id ?? ex.exerciseOrder} exercise={ex} label={`${letter}1`} />
        );
      }
    }
    return rendered;
  }

  return (
    <Box sx={{
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      bgcolor: '#fff',
      mb: 1.5,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <Box
        onClick={() => !isRest && setExpanded(!expanded)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
          cursor: isRest ? 'default' : 'pointer',
          '&:hover': isRest ? {} : { bgcolor: '#f8fafc' },
        }}
      >
        {!isRest && (expanded ? <KeyboardArrowDownIcon sx={{ color: '#94a3b8' }} /> : <KeyboardArrowRightIcon sx={{ color: '#94a3b8' }} />)}
        <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', minWidth: 40 }}>
          {item.day.slice(0, 3)}
        </Typography>
        <Chip label={item.sessionType.replace(/_/g, ' ')} size="small" sx={{ bgcolor: chipStyle.bg, color: chipStyle.text, fontWeight: 600, fontSize: '0.75rem' }} />
        <Typography sx={{ fontSize: '0.875rem', color: '#334155', flex: 1 }}>{item.focus}</Typography>
        {item.estimatedDurationMin && (
          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.estimatedDurationMin} min</Typography>
        )}
        <Chip label={statusChip.label} size="small" sx={{ bgcolor: statusChip.bg, color: statusChip.color, fontWeight: 600, fontSize: '0.6875rem' }} />
      </Box>

      {/* Expanded content */}
      <Collapse in={expanded}>
        <Divider />
        <Box sx={{ px: 2, py: 1.5 }}>
          {sectionOrder.map((sectionKey) => {
            const sectionExercises = sections.get(sectionKey);
            if (!sectionExercises?.length) return null;
            return (
              <React.Fragment key={sectionKey}>
                <SectionHeader section={sectionKey} />
                {renderExercises(sectionExercises)}
              </React.Fragment>
            );
          })}

          {item.coachCues && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: '8px' }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', mb: 0.5 }}>Coach Notes</Typography>
              <Typography sx={{ fontSize: '0.8125rem', color: '#334155' }}>{item.coachCues}</Typography>
            </Box>
          )}
        </Box>

        {/* Actions */}
        {(onStartSession || onSwapDay) && (
          <>
            <Divider />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1 }}>
              {onStartSession && <Button size="small" variant="contained" onClick={onStartSession}>Start Session</Button>}
              {onSwapDay && <Button size="small" variant="text" onClick={onSwapDay}>Swap Day</Button>}
            </Box>
          </>
        )}
      </Collapse>
    </Box>
  );
}
