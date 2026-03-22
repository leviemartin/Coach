'use client';

import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface ExerciseListItem {
  name: string;
  completed: boolean;
  current: boolean;
  setsCompleted: number;
  setsTotal: number;
}

interface ExerciseListProps {
  exercises: ExerciseListItem[];
  onSelect: (index: number) => void;
}

export default function ExerciseList({ exercises, onSelect }: ExerciseListProps) {
  return (
    <Box
      sx={{
        borderRadius: '12px',
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        backgroundColor: 'background.paper',
      }}
    >
      <List disablePadding>
        {exercises.map((ex, idx) => {
          const isCompleted = ex.completed;
          const isCurrent = ex.current && !isCompleted;

          return (
            <ListItemButton
              key={idx}
              onClick={() => onSelect(idx)}
              divider={idx < exercises.length - 1}
              sx={{
                borderLeft: isCurrent ? '3px solid #3b82f6' : '3px solid transparent',
                opacity: isCompleted ? 0.6 : 1,
                py: 1.25,
                px: 2,
                transition: 'border-color 0.2s, opacity 0.2s',
                '&:hover': {
                  backgroundColor: 'action.hover',
                },
              }}
            >
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    fontWeight={isCurrent ? 700 : 400}
                    color={
                      isCompleted
                        ? '#22c55e'
                        : isCurrent
                          ? 'text.primary'
                          : 'text.secondary'
                    }
                    sx={{ lineHeight: 1.3 }}
                  >
                    {ex.name}
                  </Typography>
                }
                secondary={
                  isCurrent ? (
                    <Typography variant="caption" color="#3b82f6" fontWeight={600}>
                      {ex.setsCompleted}/{ex.setsTotal} sets
                    </Typography>
                  ) : isCompleted ? (
                    <Typography variant="caption" color="#22c55e">
                      {ex.setsTotal}/{ex.setsTotal} sets
                    </Typography>
                  ) : (
                    <Typography variant="caption" color="text.disabled">
                      {ex.setsTotal} sets
                    </Typography>
                  )
                }
              />
              {isCompleted && (
                <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 18, ml: 1 }} />
              )}
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );
}
