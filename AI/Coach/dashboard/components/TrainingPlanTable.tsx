'use client';

import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Checkbox, TextField, IconButton, Collapse, Box, Typography,
  LinearProgress, Card, CardContent,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import type { PlanItem } from '@/lib/types';

interface TrainingPlanTableProps {
  items: PlanItem[];
  readOnly?: boolean;
  onToggleComplete?: (id: number, completed: boolean) => void;
  onUpdateNotes?: (id: number, notes: string) => void;
}

export default function TrainingPlanTable({
  items,
  readOnly = false,
  onToggleComplete,
  onUpdateNotes,
}: TrainingPlanTableProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  // Sync notes state when items prop changes
  React.useEffect(() => {
    const map: Record<number, string> = {};
    for (const item of items) {
      if (item.id != null) map[item.id] = item.athleteNotes;
    }
    setNotes(map);
  }, [items]);

  const completed = items.filter((i) => i.completed).length;
  const total = items.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  const handleNoteBlur = (id: number) => {
    if (onUpdateNotes && notes[id] !== undefined) {
      onUpdateNotes(id, notes[id]);
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Typography variant="h6">
            Training Plan ({completed}/{total} complete)
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{ mb: 2, height: 8, borderRadius: 4 }}
        />

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">Done</TableCell>
                <TableCell>Day</TableCell>
                <TableCell>Session Type</TableCell>
                <TableCell>Focus</TableCell>
                <TableCell>Starting Weight</TableCell>
                <TableCell>Workout Plan</TableCell>
                <TableCell sx={{ width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <React.Fragment key={item.id || item.dayOrder}>
                  <TableRow
                    sx={{
                      opacity: item.completed ? 0.6 : 1,
                      '& .MuiTableCell-root': {
                        textDecoration: item.completed ? 'line-through' : 'none',
                      },
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={item.completed}
                        disabled={readOnly}
                        onChange={() => {
                          if (onToggleComplete && item.id != null) {
                            onToggleComplete(item.id, !item.completed);
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{item.day}</TableCell>
                    <TableCell>{item.sessionType}</TableCell>
                    <TableCell>{item.focus}</TableCell>
                    <TableCell>{item.startingWeight}</TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography variant="body2" noWrap>
                        {item.workoutPlan}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() =>
                          setExpandedRow(expandedRow === item.id ? null : (item.id ?? null))
                        }
                      >
                        {expandedRow === item.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                  </TableRow>

                  {/* Expanded row with cues + notes */}
                  <TableRow>
                    <TableCell colSpan={7} sx={{ py: 0, borderBottom: expandedRow === item.id ? undefined : 'none' }}>
                      <Collapse in={expandedRow === item.id}>
                        <Box sx={{ p: 2 }}>
                          <Typography variant="subtitle2" color="text.secondary">
                            Coach&apos;s Cues & Mobility
                          </Typography>
                          <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
                            {item.coachCues || 'None'}
                          </Typography>

                          {!readOnly && item.id ? (
                            <TextField
                              label="My Notes"
                              multiline
                              rows={2}
                              fullWidth
                              size="small"
                              value={notes[item.id] ?? ''}
                              onChange={(e) =>
                                setNotes((prev) => ({ ...prev, [item.id!]: e.target.value }))
                              }
                              onBlur={() => handleNoteBlur(item.id!)}
                            />
                          ) : (
                            item.athleteNotes && (
                              <>
                                <Typography variant="subtitle2" color="text.secondary">
                                  My Notes
                                </Typography>
                                <Typography variant="body2">{item.athleteNotes}</Typography>
                              </>
                            )
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
