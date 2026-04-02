'use client';

import { Box, Card, CardContent, TextField, Typography } from '@mui/material';

interface EnergyPainCardProps {
  energyLevel: number | null;
  painLevel: number | null;
  painArea: string | null;
  onEnergyChange: (level: number) => void;
  onPainChange: (level: number) => void;
  onPainAreaChange: (area: string) => void;
}

const buttonBase = {
  width: 36,
  height: 34,
  borderRadius: 0,
  border: '2px solid',
  borderColor: '#e4e4e0',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: '0.8125rem',
  fontWeight: 600,
  userSelect: 'none' as const,
  transition: 'background 0.1s, border-color 0.1s',
  bgcolor: '#ffffff',
  color: '#18181b',
  '&:hover': { borderColor: '#18181b', bgcolor: '#f0f0eb' },
};

const selectedAmber = {
  bgcolor: '#f59e0b18',
  borderColor: '#f59e0b',
  color: '#b45309',
};

const selectedGreen = {
  bgcolor: '#22c55e18',
  borderColor: '#22c55e',
  color: '#15803d',
};

const PAIN_LABELS = ['None', 'Mild', 'Mod', 'Stop'];

export default function EnergyPainCard({
  energyLevel,
  painLevel,
  painArea,
  onEnergyChange,
  onPainChange,
  onPainAreaChange,
}: EnergyPainCardProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          How are you feeling?
        </Typography>

        {/* Energy row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, minWidth: 48, color: 'text.primary' }}
          >
            Energy
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {[1, 2, 3, 4, 5].map((level) => {
              const isSelected = energyLevel === level;
              return (
                <Box
                  key={level}
                  component="button"
                  onClick={() => onEnergyChange(level)}
                  sx={{
                    ...buttonBase,
                    ...(isSelected ? selectedAmber : {}),
                  }}
                >
                  {level}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Pain row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: painLevel && painLevel > 0 ? 1.5 : 0 }}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, minWidth: 48, color: 'text.primary' }}
          >
            Pain
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {PAIN_LABELS.map((label, idx) => {
              const isSelected = painLevel === idx;
              const selectedStyle = idx === 0 ? selectedGreen : selectedAmber;
              return (
                <Box
                  key={label}
                  component="button"
                  onClick={() => onPainChange(idx)}
                  sx={{
                    ...buttonBase,
                    width: 'auto',
                    px: 1,
                    ...(isSelected ? selectedStyle : {}),
                  }}
                >
                  {label}
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Pain area text field — only when pain > 0 */}
        {painLevel !== null && painLevel > 0 && (
          <TextField
            size="small"
            placeholder="Where?"
            value={painArea || ''}
            onChange={(e) => onPainAreaChange(e.target.value)}
            sx={{ ml: '60px', width: 200 }}
          />
        )}
      </CardContent>
    </Card>
  );
}
