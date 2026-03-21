'use client';

import { Typography, Box } from '@mui/material';
import HeroCard from './HeroCard';
import { cardAccents, typography } from '@/lib/design-tokens';

interface ComplianceRingProps {
  compliancePct: number | null;
  vampireDays: number;
  rugDays: number;
  hydrationDays: number;
}

export default function ComplianceRing({
  compliancePct,
  vampireDays,
  rugDays,
  hydrationDays,
}: ComplianceRingProps) {
  const pct = compliancePct ?? 0;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <HeroCard label="Protocols" accentColor={cardAccents.protocols}>
      <Box sx={{ textAlign: 'center', py: 0.5 }}>
        <svg width="70" height="70" viewBox="0 0 70 70" style={{ margin: '0 auto', display: 'block' }}>
          <circle cx="35" cy="35" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="6" />
          <circle
            cx="35" cy="35" r={radius}
            fill="none"
            stroke={cardAccents.protocols}
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 35 35)"
          />
          <text x="35" y="38" textAnchor="middle" fontSize="16" fontWeight="800" fill="#0f172a">
            {pct}%
          </text>
        </svg>
        <Typography sx={{ fontSize: '0.6875rem', color: '#64748b', mt: 0.5 }}>
          {'\u{1F9DB}'} {vampireDays}/7 · {'\u{1F9D8}'} {rugDays}/7 · {'\u{1F4A7}'} {hydrationDays}/7
        </Typography>
      </Box>
    </HeroCard>
  );
}
