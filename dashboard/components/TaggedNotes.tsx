'use client';

import React, { useState } from 'react';
import { Box, Card, CardContent, Chip, IconButton, TextField, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export interface DailyNote {
  id: number;
  daily_log_id: number;
  category: 'injury' | 'sleep' | 'training' | 'life' | 'other';
  text: string;
  created_at: string;
}

export interface TaggedNotesProps {
  dailyLogId: number | null;
  notes: DailyNote[];
  onNotesChange: () => void;
}

type Category = DailyNote['category'];

const CATEGORIES: Category[] = ['injury', 'sleep', 'training', 'life', 'other'];

const CATEGORY_STYLES: Record<Category, { bg: string; color: string }> = {
  injury:   { bg: '#ffedd5', color: '#c2410c' },
  sleep:    { bg: '#ede9fe', color: '#6d28d9' },
  training: { bg: '#dbeafe', color: '#1d4ed8' },
  life:     { bg: '#fef3c7', color: '#b45309' },
  other:    { bg: '#f1f5f9', color: '#64748b' },
};

export default function TaggedNotes({ dailyLogId, notes, onNotesChange }: TaggedNotesProps) {
  const [adding, setAdding] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category>('other');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!dailyLogId || !text.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/log/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ daily_log_id: dailyLogId, category: selectedCategory, text: text.trim() }),
      });
      setText('');
      setSelectedCategory('other');
      setAdding(false);
      onNotesChange();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/log/notes?id=${id}`, { method: 'DELETE' });
    onNotesChange();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === 'Escape') {
      setAdding(false);
      setText('');
      setSelectedCategory('other');
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Notes
        </Typography>

        {/* Existing notes */}
        {notes.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mb: adding ? 1.5 : 0 }}>
            {notes.map((note) => {
              const style = CATEGORY_STYLES[note.category];
              return (
                <Box
                  key={note.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                  }}
                >
                  <Chip
                    label={note.category}
                    size="small"
                    sx={{
                      bgcolor: style.bg,
                      color: style.color,
                      fontWeight: 600,
                      fontSize: '0.6875rem',
                      height: 22,
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="body2" sx={{ flexGrow: 1, lineHeight: 1.5, mt: '1px' }}>
                    {note.text}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleDelete(note.id)}
                    aria-label={`Delete ${note.category} note`}
                    sx={{ p: 0.25, color: 'text.disabled', flexShrink: 0 }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              );
            })}
          </Box>
        )}

        {/* Add note form */}
        {adding ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {/* Category chips */}
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {CATEGORIES.map((cat) => {
                const style = CATEGORY_STYLES[cat];
                const selected = selectedCategory === cat;
                return (
                  <Chip
                    key={cat}
                    label={cat}
                    size="small"
                    onClick={() => setSelectedCategory(cat)}
                    sx={{
                      bgcolor: selected ? style.bg : 'transparent',
                      color: selected ? style.color : 'text.secondary',
                      border: `1px solid ${selected ? style.color : '#e2e8f0'}`,
                      fontWeight: selected ? 700 : 400,
                      fontSize: '0.6875rem',
                      height: 24,
                      cursor: 'pointer',
                    }}
                  />
                );
              })}
            </Box>

            {/* Text input */}
            <TextField
              autoFocus
              size="small"
              fullWidth
              placeholder="Add a note..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              multiline
              maxRows={4}
            />

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography
                variant="body2"
                component="button"
                onClick={handleAdd}
                disabled={saving || !text.trim() || !dailyLogId}
                sx={{
                  cursor: 'pointer',
                  color: 'primary.main',
                  fontWeight: 600,
                  border: 'none',
                  background: 'none',
                  p: 0,
                  '&:disabled': { color: 'text.disabled', cursor: 'default' },
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </Typography>
              <Typography
                variant="body2"
                component="button"
                onClick={() => {
                  setAdding(false);
                  setText('');
                  setSelectedCategory('other');
                }}
                sx={{
                  cursor: 'pointer',
                  color: 'text.secondary',
                  border: 'none',
                  background: 'none',
                  p: 0,
                }}
              >
                Cancel
              </Typography>
            </Box>
          </Box>
        ) : (
          <Typography
            variant="body2"
            component="button"
            onClick={() => setAdding(true)}
            sx={{
              cursor: 'pointer',
              color: 'text.secondary',
              border: 'none',
              background: 'none',
              p: 0,
              mt: notes.length > 0 ? 1 : 0,
              '&:hover': { color: 'primary.main' },
            }}
          >
            + Add note
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
