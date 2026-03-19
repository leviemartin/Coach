'use client';

import { Box, Typography, Chip } from '@mui/material';

interface Priority {
  label: string;
  status: 'critical' | 'active' | 'monitoring';
  detail?: string;
}

// NOTE: These priorities are from CLAUDE.md section 11 and may change over time.
// When priorities update in CLAUDE.md, update this list manually.
const PRIORITIES: Priority[] = [
  { label: 'Sleep / Vampire Protocol', status: 'critical', detail: 'Bedtime compliance is #1 limiter' },
  { label: 'Pull-up Progression', status: 'active', detail: '2 → 5-6 by Zandvoort, 10 by race day' },
  { label: 'Core Stability 3x/week', status: 'active', detail: 'Protects lower back from kid-lifting' },
  { label: 'Aerobic High (Zone 4)', status: 'active', detail: 'StairMaster 3-4 min intervals' },
  { label: 'Anaerobic Deficit', status: 'active', detail: 'Rower 20s/>300W/1:40 rest' },
  { label: 'Hydration Tracking', status: 'critical', detail: 'Zero compliance — every week until started' },
  { label: 'Zandvoort Prep', status: 'monitoring', detail: '~8 weeks out — walk-to-jog progression' },
  { label: 'Baker\'s Cyst', status: 'monitoring', detail: 'Pain-free — physio before Phase 2' },
];

const STATUS_COLORS: Record<string, 'error' | 'warning' | 'info'> = {
  critical: 'error',
  active: 'warning',
  monitoring: 'info',
};

export default function PrioritiesList() {
  return (
    <Box>
      {PRIORITIES.map((p, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75, borderBottom: i < PRIORITIES.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 20, fontWeight: 600 }}>
            {i + 1}.
          </Typography>
          <Chip label={p.status} size="small" color={STATUS_COLORS[p.status]} variant="outlined" sx={{ minWidth: 80 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" fontWeight={600}>{p.label}</Typography>
            {p.detail && (
              <Typography variant="caption" color="text.secondary">{p.detail}</Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
