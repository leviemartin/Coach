'use client';

import { Chip, type ChipProps } from '@mui/material';

interface StatusBadgeProps {
  value: number | null;
  greenThreshold: number;
  yellowThreshold: number;
  label?: string;
  invert?: boolean; // true = lower is better (e.g., pain)
  size?: ChipProps['size'];
}

export default function StatusBadge({
  value,
  greenThreshold,
  yellowThreshold,
  label,
  invert = false,
  size = 'small',
}: StatusBadgeProps) {
  if (value === null || value === undefined) {
    return <Chip label={label || '—'} size={size} variant="outlined" />;
  }

  let color: 'success' | 'warning' | 'error';
  if (invert) {
    color = value <= yellowThreshold ? 'success' : value <= greenThreshold ? 'warning' : 'error';
  } else {
    color = value >= greenThreshold ? 'success' : value >= yellowThreshold ? 'warning' : 'error';
  }

  return (
    <Chip
      label={label || String(value)}
      color={color}
      size={size}
      variant="filled"
    />
  );
}
