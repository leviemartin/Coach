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
  borderRadius: '4px',
  border: '1px solid #e2e8f0',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.8125rem',
  fontWeight: 600,
  userSelect: 'none' as const,
  transition: 'background 0.1s, border-color 0.1s',
  bgcolor: '#fff',
  color: '#374151',
  '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' },
};

const selectedAmber = {
  bgcolor: '#fef3c7',
  borderColor: '#f59e0b',
  color: '#b45309',
};

const selectedGreen = {
  bgcolor: '#dcfce7',
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
            sx={{ fontWeight: 600, minWidth: 48, color: '#374151' }}
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
            sx={{ fontWeight: 600, minWidth: 48, color: '#374151' }}
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
