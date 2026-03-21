'use client';

import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  TextField,
  Typography,
} from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';

// Inline conversion — cannot import from lib/daily-log.ts (uses server-only 'path' module)
function toBedtimeStorage(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (h < 6) return `${h + 24}:${m.toString().padStart(2, '0')}`;
  return time;
}

function fromBedtimeStorage(stored: string): string {
  const [h, m] = stored.split(':').map(Number);
  if (h >= 24) return `${(h - 24).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  return stored;
}

interface BedtimeCardProps {
  bedtime: string | null; // stored in 24h+ format
  onUpdate: (bedtime: string | null) => void;
}

type ComplianceLevel = 'on-time' | 'late' | 'way-late';

function getComplianceLevel(stored: string): ComplianceLevel {
  const [h] = stored.split(':').map(Number);
  if (h < 23) return 'on-time';
  if (h < 24) return 'late';
  return 'way-late';
}

const COMPLIANCE_CHIP: Record<ComplianceLevel, { label: string; color: 'success' | 'warning' | 'error' }> = {
  'on-time': { label: 'On time', color: 'success' },
  'late':    { label: 'Late',    color: 'warning' },
  'way-late':{ label: 'Way late',color: 'error'   },
};

export default function BedtimeCard({ bedtime, onUpdate }: BedtimeCardProps) {
  const [editing, setEditing] = useState(false);

  const displayTime = bedtime ? fromBedtimeStorage(bedtime) : '';
  const complianceLevel = bedtime ? getComplianceLevel(bedtime) : null;
  const chip = complianceLevel ? COMPLIANCE_CHIP[complianceLevel] : null;

  // After-midnight caption: display hour is 00-05
  const displayHour = displayTime ? parseInt(displayTime.split(':')[0], 10) : null;
  const isAfterMidnight = displayHour !== null && displayHour >= 0 && displayHour < 6;

  function handleLightsOut() {
    const now = new Date();
    const hh = now.getHours().toString().padStart(2, '0');
    const mm = now.getMinutes().toString().padStart(2, '0');
    const raw = `${hh}:${mm}`;
    onUpdate(toBedtimeStorage(raw));
  }

  function handleTimeChange(value: string) {
    if (!value) {
      onUpdate(null);
      return;
    }
    onUpdate(toBedtimeStorage(value));
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Bedtime (Vampire Protocol)
        </Typography>

        {!bedtime && !editing ? (
          // State 1: no bedtime logged, not editing
          <Button
            variant="contained"
            startIcon={<DarkModeIcon />}
            onClick={handleLightsOut}
            sx={{
              bgcolor: 'indigo.main',
              background: 'linear-gradient(135deg, #3730a3 0%, #1e1b4b 100%)',
              color: '#fff',
              '&:hover': {
                background: 'linear-gradient(135deg, #4338ca 0%, #312e81 100%)',
              },
            }}
          >
            Lights Out
          </Button>
        ) : bedtime && !editing ? (
          // State 2: bedtime logged, not editing
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight={600}>
              Logged at {displayTime}
            </Typography>
            {chip && (
              <Chip label={chip.label} color={chip.color} size="small" />
            )}
            <Button size="small" variant="outlined" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </Box>
        ) : (
          // State 3: editing
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <TextField
              type="time"
              value={displayTime}
              onChange={(e) => handleTimeChange(e.target.value)}
              size="small"
              sx={{ width: 160 }}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Button
              size="small"
              variant="contained"
              onClick={() => setEditing(false)}
            >
              Done
            </Button>
          </Box>
        )}

        {isAfterMidnight && displayTime && (
          <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
            After midnight — logged as next-day bedtime
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
