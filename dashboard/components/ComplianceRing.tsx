'use client';

import { Typography, Box } from '@mui/material';
import HeroCard from './HeroCard';
import { cardAccents, borders } from '@/lib/design-tokens';

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
  const totalPips = 10;
  const filledPips = Math.round((pct / 100) * totalPips);

  return (
    <HeroCard label="Protocols" accentColor={cardAccents.protocols}>
      <Box sx={{ py: 0.5 }}>
        {/* Percentage */}
        <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 800, fontSize: '2rem', textAlign: 'center', lineHeight: 1 }}>
          {pct}%
        </Typography>

        {/* Pip bar */}
        <Box sx={{ display: 'flex', gap: '2px', mt: 1, mb: 1 }}>
          {Array.from({ length: totalPips }, (_, i) => (
            <Box
              key={i}
              sx={{
                flex: 1,
                height: 6,
                bgcolor: i < filledPips ? cardAccents.protocols : borders.soft,
              }}
            />
          ))}
        </Box>

        {/* Protocol breakdown */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5 }}>
          <ProtocolStat label="Lights Out" value={vampireDays} />
          <ProtocolStat label="Mobility" value={rugDays} />
          <ProtocolStat label="Hydration" value={hydrationDays} />
        </Box>
      </Box>
    </HeroCard>
  );
}

function ProtocolStat({ label, value }: { label: string; value: number }) {
  return (
    <Box sx={{ textAlign: 'center' }}>
      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, fontSize: '0.8125rem' }}>
        {value}/7
      </Typography>
      <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.5rem', fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
        {label}
      </Typography>
    </Box>
  );
}
