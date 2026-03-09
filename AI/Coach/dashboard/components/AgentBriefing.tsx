'use client';

import React from 'react';
import {
  Card, CardContent, Typography, Box, Accordion, AccordionSummary,
  AccordionDetails, Chip, LinearProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MarkdownRenderer from './MarkdownRenderer';

const AGENT_COLORS: Record<string, string> = {
  strength: '#C62828',
  endurance: '#2E7D32',
  ocr: '#E65100',
  nutrition: '#6A1B9A',
  recovery: '#00838F',
  mobility: '#4E342E',
  mental: '#283593',
};

interface SpecialistOutput {
  agentId: string;
  label: string;
  content: string;
  error: string | null;
}

interface AgentBriefingProps {
  specialists: SpecialistOutput[];
  synthesis: string;
  completedCount: number;
  totalCount: number;
  synthesisStreaming: boolean;
}

export default function AgentBriefing({
  specialists,
  synthesis,
  completedCount,
  totalCount,
  synthesisStreaming,
}: AgentBriefingProps) {
  const allDone = completedCount === totalCount;

  return (
    <Box>
      {/* Specialist progress */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Specialist Analyses ({completedCount}/{totalCount})
          </Typography>
          <LinearProgress
            variant="determinate"
            value={totalCount > 0 ? (completedCount / totalCount) * 100 : 0}
            sx={{ mb: 2, height: 8, borderRadius: 4 }}
          />
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {['strength', 'endurance', 'ocr', 'nutrition', 'recovery', 'mobility', 'mental'].map((id) => {
              const spec = specialists.find((s) => s.agentId === id);
              return (
                <Chip
                  key={id}
                  label={id.charAt(0).toUpperCase() + id.slice(1)}
                  color={spec ? (spec.error ? 'error' : 'success') : 'default'}
                  variant={spec ? 'filled' : 'outlined'}
                  size="small"
                />
              );
            })}
          </Box>
        </CardContent>
      </Card>

      {/* Specialist details (collapsible) */}
      {specialists.length > 0 && (
        <Box sx={{ mb: 3 }}>
          {specialists.map((spec) => (
            <Accordion key={spec.agentId} defaultExpanded={false}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box
                  sx={{
                    width: 4,
                    borderRadius: 2,
                    bgcolor: AGENT_COLORS[spec.agentId] || 'grey.500',
                    mr: 2,
                    alignSelf: 'stretch',
                  }}
                />
                <Typography fontWeight={600}>{spec.label}</Typography>
                {spec.error && (
                  <Chip label="Error" color="error" size="small" sx={{ ml: 1 }} />
                )}
              </AccordionSummary>
              <AccordionDetails>
                {spec.error ? (
                  <Typography color="error">{spec.error}</Typography>
                ) : (
                  <MarkdownRenderer content={spec.content} />
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Head Coach Synthesis */}
      {(allDone || synthesis) && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Typography variant="h5" fontWeight={700}>
                Head Coach Synthesis
              </Typography>
              {synthesisStreaming && <StreamingIndicator />}
            </Box>
            <MarkdownRenderer content={synthesis} />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

function StreamingIndicator() {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
      <LinearProgress sx={{ width: 60, borderRadius: 2 }} />
    </Box>
  );
}
