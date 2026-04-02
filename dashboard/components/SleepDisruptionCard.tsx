'use client';

import { Box, Card, CardContent, Chip, Typography } from '@mui/material';
import { typography, borders } from '@/lib/design-tokens';

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
        bgcolor: 'background.paper',
        border: '2px solid',
        borderColor: 'divider',
      }}
    >
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Typography
          sx={{
            ...typography.categoryLabel,
            display: 'block',
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
                        bgcolor: '#f59e0b18',
                        color: '#b45309',
                        fontWeight: 600,
                        border: `2px solid #f59e0b`,
                        '&:hover': { bgcolor: '#f59e0b25' },
                      }
                    : {
                        bgcolor: 'background.paper',
                        color: 'text.primary',
                        border: `2px solid ${borders.soft}`,
                        '&:hover': { bgcolor: 'action.hover', borderColor: borders.hard },
                      }
                }
              />
            );
          })}
        </Box>

        <Typography
          variant="caption"
          sx={{ display: 'block', color: 'text.secondary', mt: 1 }}
        >
          → saved to {previousDayName} night
        </Typography>
      </CardContent>
    </Card>
  );
}
