'use client';

import { Card, CardContent, TextField, Typography } from '@mui/material';

interface NotesCardProps {
  notes: string | null;
  onUpdate: (notes: string | null) => void;
}

export default function NotesCard({ notes, onUpdate }: NotesCardProps) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Notes
        </Typography>
        <TextField
          multiline
          rows={3}
          fullWidth
          placeholder="Any notes (injuries, sleep disruptions, etc.)"
          value={notes || ''}
          onChange={(e) => onUpdate(e.target.value || null)}
          size="small"
        />
      </CardContent>
    </Card>
  );
}
