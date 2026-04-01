'use client';
import { Box, Typography } from '@mui/material';

interface DurationInputProps {
  value: string;
  placeholder?: string;
  unit?: 'sec' | 'min';
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function DurationInput({ value, placeholder = '—', unit = 'sec', onChange, disabled = false }: DurationInputProps) {
  return (
    <>
      <Box component="input" value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder} disabled={disabled} inputMode="numeric"
        sx={{
          width: 64, backgroundColor: disabled ? '#f0f0eb' : '#fff', border: '2px solid #d4d4d0',
          padding: '7px 6px', fontFamily: '"JetBrains Mono", monospace', fontSize: '0.875rem',
          fontWeight: 500, textAlign: 'center', outline: 'none',
          '&:focus': { borderColor: '#18181b' }, '&::placeholder': { color: '#d4d4d0', fontStyle: 'italic' },
        }}
      />
      <Typography sx={{
        fontFamily: '"JetBrains Mono", monospace', fontSize: '0.625rem', fontWeight: 700,
        color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px', width: 24,
      }}>
        {unit}
      </Typography>
    </>
  );
}
