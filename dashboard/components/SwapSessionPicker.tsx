'use client';

import { useState } from 'react';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Typography,
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { semanticColors } from '@/lib/design-tokens';
import type { PlanItem } from '@/lib/types';

export interface SwapSessionPickerProps {
  weekItems: PlanItem[];
  currentDate: string;
  suggestedItemId: number | null;
  onSwap: (planItemId: number) => Promise<void>;
  onCancel: () => void;
}

// Day order for display labels
const DAY_ABBR: Record<string, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

export default function SwapSessionPicker({
  weekItems,
  currentDate,
  suggestedItemId,
  onSwap,
  onCancel,
}: SwapSessionPickerProps) {
  const [swapping, setSwapping] = useState<number | null>(null);

  const handleSelect = async (item: PlanItem) => {
    if (!item.id || item.status === 'completed') return;
    setSwapping(item.id);
    try {
      await onSwap(item.id);
    } finally {
      setSwapping(null);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
          Swap session
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: semanticColors.body,
            cursor: 'pointer',
            '&:hover': { opacity: 0.7 },
          }}
          onClick={onCancel}
        >
          Cancel
        </Typography>
      </Box>

      {/* Session cards */}
      {weekItems.map((item) => {
        if (!item.id) return null;

        const isCompleted = item.status === 'completed';
        const isSuggested = item.id === suggestedItemId;
        const isLoading = swapping === item.id;
        const seqNum = item.sequenceOrder ?? item.dayOrder;
        const seqNotes = item.sequenceNotes ?? null;
        const dayLabel = DAY_ABBR[item.day] ?? item.day;

        // Warning: item has sequence notes that imply constraint (non-suggested, non-completed)
        // We surface sequence notes as a warning when the item is not the suggested one
        // and has notes (the API populates these with constraint text when relevant)
        const hasWarning = !isSuggested && !isCompleted && !!seqNotes && seqNotes.length > 0;

        if (isCompleted) {
          return (
            <Card
              key={item.id}
              variant="outlined"
              sx={{ opacity: 0.45, cursor: 'default' }}
            >
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                  <Chip label={item.sessionType} size="small" color="default" variant="filled" />
                  <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                    {item.focus}
                  </Typography>
                  <Chip
                    label={`Done ${dayLabel}`}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                </Box>
                {seqNotes && (
                  <Typography variant="caption" color="text.disabled">
                    Seq #{seqNum} · {seqNotes}
                  </Typography>
                )}
              </CardContent>
            </Card>
          );
        }

        return (
          <Card
            key={item.id}
            variant="outlined"
            sx={{
              borderColor: hasWarning
                ? semanticColors.recovery.caution
                : isSuggested
                  ? semanticColors.body
                  : 'divider',
              borderWidth: isSuggested || hasWarning ? 2 : 1,
              opacity: isLoading ? 0.6 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <CardActionArea
              onClick={() => handleSelect(item)}
              disabled={isLoading}
              sx={{ borderRadius: 'inherit' }}
            >
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                {/* Top row: session type chip + focus + status chip */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                  <Chip
                    label={item.sessionType}
                    size="small"
                    color={isSuggested ? 'primary' : 'default'}
                    variant={isSuggested ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 600 }}
                  />
                  <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                    {item.focus}
                  </Typography>
                  {isSuggested && (
                    <Chip
                      label="Suggested"
                      size="small"
                      color="success"
                      variant="outlined"
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                  {!isSuggested && !hasWarning && (
                    <Chip
                      label="Available"
                      size="small"
                      sx={{
                        color: 'text.secondary',
                        borderColor: 'text.secondary',
                        fontWeight: 600,
                      }}
                      variant="outlined"
                    />
                  )}
                  {hasWarning && (
                    <Chip
                      icon={<WarningAmberIcon fontSize="small" />}
                      label="Warning"
                      size="small"
                      sx={{
                        backgroundColor: semanticColors.recovery.caution,
                        color: '#fff',
                        fontWeight: 600,
                        '& .MuiChip-icon': { color: '#fff' },
                      }}
                    />
                  )}
                </Box>

                {/* Caption: sequence info */}
                {seqNotes ? (
                  <Typography
                    variant="caption"
                    sx={{
                      color: hasWarning
                        ? semanticColors.recovery.caution
                        : 'text.secondary',
                      fontWeight: hasWarning ? 600 : 400,
                      display: 'block',
                    }}
                  >
                    Seq #{seqNum} · {seqNotes}
                  </Typography>
                ) : seqNum ? (
                  <Typography variant="caption" color="text.secondary">
                    Seq #{seqNum}
                  </Typography>
                ) : null}
              </CardContent>
            </CardActionArea>
          </Card>
        );
      })}

      {weekItems.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
          No sessions found for this week.
        </Typography>
      )}
    </Box>
  );
}
