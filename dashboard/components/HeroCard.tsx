'use client';

import { Card, CardContent, Typography, Box } from '@mui/material';
import { heroCardSx, typography } from '@/lib/design-tokens';

interface HeroCardProps {
  label: string;
  accentColor: string;
  children: React.ReactNode;
}

export default function HeroCard({ label, accentColor, children }: HeroCardProps) {
  return (
    <Card sx={heroCardSx(accentColor)}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography sx={typography.categoryLabel}>
          {label}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}
