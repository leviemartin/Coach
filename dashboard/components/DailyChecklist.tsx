'use client';

import { Box, Card, CardContent, Checkbox, Chip, FormControlLabel, Typography } from '@mui/material';
import { getComplianceColor } from '@/lib/daily-log';

export interface WeekTallies {
  core: number;
  rug: number;
  kitchen: number;
  hydration: number;
}

export interface DailyChecklistProps {
  coreWorkDone: number;
  rugProtocolDone: number;
  kitchenCutoffHit: number;
  hydrationTracked: number;
  weekTallies: WeekTallies;
  onUpdate: (field: string, value: number) => void;
}

interface ChecklistItem {
  field: string;
  label: string;
  checked: boolean;
  tallyKey: keyof WeekTallies;
  target: number;
}

export default function DailyChecklist({
  coreWorkDone,
  rugProtocolDone,
  kitchenCutoffHit,
  hydrationTracked,
  weekTallies,
  onUpdate,
}: DailyChecklistProps) {
  const items: ChecklistItem[] = [
    {
      field: 'core_work_done',
      label: 'Core work done',
      checked: !!coreWorkDone,
      tallyKey: 'core',
      target: 3,
    },
    {
      field: 'rug_protocol_done',
      label: 'Rug Protocol (GOWOD)',
      checked: !!rugProtocolDone,
      tallyKey: 'rug',
      target: 7,
    },
    {
      field: 'kitchen_cutoff_hit',
      label: 'Kitchen Cutoff (20:00)',
      checked: !!kitchenCutoffHit,
      tallyKey: 'kitchen',
      target: 7,
    },
    {
      field: 'hydration_tracked',
      label: 'Hydration tracked',
      checked: !!hydrationTracked,
      tallyKey: 'hydration',
      target: 7,
    },
  ];

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Daily Checklist
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {items.map((item) => {
            const tally = weekTallies[item.tallyKey];
            const color = getComplianceColor(tally, item.target);
            return (
              <Box
                key={item.field}
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={item.checked}
                      onChange={(e) => onUpdate(item.field, e.target.checked ? 1 : 0)}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">{item.label}</Typography>}
                  sx={{ m: 0, flex: 1 }}
                />
                <Chip
                  label={`${tally}/${item.target}`}
                  size="small"
                  color={color}
                  variant="outlined"
                  sx={{ minWidth: 48, fontWeight: 600 }}
                />
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}
