'use client';

import { Box, Typography, Button } from '@mui/material';
import Link from 'next/link';

export default function AuthError() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2,
        p: 3,
      }}
    >
      <Typography variant="h4" fontWeight={700}>
        Access Denied
      </Typography>
      <Typography variant="body1" color="text.secondary" textAlign="center">
        This dashboard is restricted to authorized users.
      </Typography>
      <Button variant="contained" component={Link} href="/api/auth/signin">
        Try Again
      </Button>
    </Box>
  );
}
