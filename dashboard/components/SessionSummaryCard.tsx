'use client';

import { useState } from 'react';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export interface SessionSummaryCardProps {
  sessionSummary: string;
}

function parseCompliance(firstLine: string): number | null {
  const match = firstLine.match(/\((\d+)%\s*compliance\)/);
  if (!match) return null;
  return parseInt(match[1], 10);
}

function complianceColor(pct: number): 'success' | 'warning' | 'error' {
  if (pct >= 80) return 'success';
  if (pct >= 60) return 'warning';
  return 'error';
}

export default function SessionSummaryCard({ sessionSummary }: SessionSummaryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const lines = sessionSummary.split('\n');
  const firstLine = lines[0] ?? '';
  const detailLines = lines.slice(1);

  const compliance = parseCompliance(firstLine);

  // Strip the compliance part from the title for the chip label
  // e.g. "Upper Push (92% compliance)" -> "Upper Push"
  const titleMatch = firstLine.match(/^(.+?)\s*\(\d+%/);
  const sessionTitle = titleMatch ? titleMatch[1].trim() : firstLine;

  return (
    <Box
      sx={{
        bgcolor: '#fff',
        border: '1px solid #e2e8f0',
        borderLeft: '4px solid #22c55e',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
        }}
      >
        <Chip
          label={sessionTitle}
          size="small"
          sx={{
            bgcolor: '#dcfce7',
            color: '#15803d',
            fontWeight: 700,
            fontSize: '0.75rem',
          }}
        />

        {compliance !== null && (
          <Chip
            label={`${compliance}%`}
            size="small"
            color={complianceColor(compliance)}
            sx={{ fontWeight: 700, fontSize: '0.75rem' }}
          />
        )}

        <Box sx={{ flex: 1 }} />

        {detailLines.length > 0 && (
          <IconButton
            size="small"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse session details' : 'Expand session details'}
            sx={{
              transition: 'transform 0.2s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          >
            <ExpandMoreIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Expandable detail lines */}
      {detailLines.length > 0 && (
        <Collapse in={expanded}>
          <Box
            sx={{
              px: 2,
              pb: 1.5,
              borderTop: '1px solid #f1f5f9',
            }}
          >
            <Typography
              variant="caption"
              component="div"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: '#374151',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                pt: 1,
              }}
            >
              {detailLines.join('\n')}
            </Typography>
          </Box>
        </Collapse>
      )}
    </Box>
  );
}
