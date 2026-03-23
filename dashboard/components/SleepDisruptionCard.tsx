'use client';

import { Box, Card, CardContent, Chip, Typography } from '@mui/material';

interface SleepDisruptionCardProps {
  value: string | null;
  previousDayName: string;
  onChange: (value: string | null) => void;
}

const TAGS: { label: string; value: string | null }[] = [
  { label: 'None', value: null },
  { label: 'Kids woke up', value: 'kids' },
  { label: 'Stress / mind racing', value: 'stress' },
  { label: 'Pain', value: 'pain' },
  { label: 'Other', value: 'other' },
];

export default function SleepDisruptionCard({
  value,
  previousDayName,
  onChange,
}: SleepDisruptionCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        bgcolor: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#64748b',
            mb: 1,
          }}
        >
          How was last night?
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {TAGS.map((tag) => {
            const isSelected = value === tag.value;
            return (
              <Chip
                key={tag.label}
                label={tag.label}
                size="small"
                onClick={() => onChange(tag.value)}
                sx={
                  isSelected
                    ? {
                        bgcolor: '#fef3c7',
                        borderColor: '#f59e0b',
                        color: '#b45309',
                        fontWeight: 600,
                        border: '1px solid #f59e0b',
                        '&:hover': { bgcolor: '#fde68a' },
                      }
                    : {
                        bgcolor: '#fff',
                        borderColor: '#e2e8f0',
                        color: '#374151',
                        border: '1px solid #e2e8f0',
                        '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' },
                      }
                }
              />
            );
          })}
        </Box>

        <Typography
          variant="caption"
          sx={{ display: 'block', color: '#94a3b8', mt: 1 }}
        >
          → saved to {previousDayName} night
        </Typography>
      </CardContent>
    </Card>
  );
}
