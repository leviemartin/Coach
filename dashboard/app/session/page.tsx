import { Suspense } from 'react';
import { CircularProgress, Box } from '@mui/material';
import SessionPage from '@/components/tracker/SessionPage';

function SessionFallback() {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <CircularProgress />
    </Box>
  );
}

export default function SessionRoute() {
  return (
    <Suspense fallback={<SessionFallback />}>
      <SessionPage />
    </Suspense>
  );
}
