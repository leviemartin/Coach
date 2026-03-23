'use client';

import React from 'react';
import { Box, Typography, Chip, Button, Divider, Tooltip } from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import type { PlanItem } from '@/lib/types';
import PlanDayCard from './PlanDayCard';

// ─── Week date range helper ───────────────────────────────────────────────────

function weekDateRange(items: PlanItem[]): string {
  const withDates = items.filter(i => i.assignedDate);
  if (withDates.length >= 2) {
    const first = withDates[0].assignedDate!;
    const last = withDates[withDates.length - 1].assignedDate!;
    const fmt = (d: string) => {
      const date = new Date(d);
      return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
    };
    return `${fmt(first)} — ${fmt(last)}`;
  }
  // Fallback: show day range from item.day strings
  if (items.length >= 2) {
    return `${items[0].day} — ${items[items.length - 1].day}`;
  }
  return '';
}

// ─── Component ────────────────────────────────────────────────────────────────

interface PlanPreviewProps {
  items: PlanItem[];
  weekNumber: number;
  onLockIn: () => void;
}

export default function PlanPreview({ items, weekNumber, onLockIn }: PlanPreviewProps) {
  if (!items || items.length === 0) return null;

  const dateRange = weekDateRange(items);

  return (
    <Box sx={{ mt: 4 }}>
      {/* Header row */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 2,
        flexWrap: 'wrap',
        gap: 1,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: '-0.025em' }}>
            Week {weekNumber}
          </Typography>
          {dateRange && (
            <Box sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 1.5,
              py: 0.5,
              borderRadius: '6px',
              bgcolor: '#f1f5f9',
              border: '1px solid #e2e8f0',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: '#0f172a',
            }}>
              {dateRange}
            </Box>
          )}
        </Box>

        {/* Draft chip */}
        <Chip
          label="Draft — review before locking in"
          variant="outlined"
          size="small"
          sx={{
            border: '1px solid #22c55e',
            color: '#15803d',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        />
      </Box>

      {/* Day cards */}
      <Box>
        {items.map((item, idx) => (
          <PlanDayCard
            key={item.id ?? idx}
            item={item}
            defaultExpanded={idx === 0}
          />
        ))}
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* Action row */}
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mb: 1.5 }}>
          Satisfied with this plan?
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
          <Tooltip title="Coming in Phase D" placement="top" arrow>
            <span>
              <Button
                variant="outlined"
                disabled
                startIcon={<ChatBubbleOutlineIcon />}
                sx={{
                  borderColor: '#e2e8f0',
                  color: '#64748b',
                  '&.Mui-disabled': {
                    borderColor: '#e2e8f0',
                    color: '#94a3b8',
                  },
                }}
              >
                Discuss with Head Coach
              </Button>
            </span>
          </Tooltip>

          <Button
            variant="contained"
            size="large"
            onClick={onLockIn}
            startIcon={<LockIcon />}
            sx={{
              bgcolor: '#22c55e',
              color: '#ffffff',
              px: 3,
              py: 1,
              '&:hover': { bgcolor: '#16a34a' },
            }}
          >
            Lock In Plan
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
