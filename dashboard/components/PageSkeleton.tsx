import { Box, Skeleton, Grid } from '@mui/material';

interface PageSkeletonProps {
  variant: 'charts' | 'cards' | 'profile';
}

export default function PageSkeleton({ variant }: PageSkeletonProps) {
  if (variant === 'charts') {
    return (
      <Grid container spacing={2}>
        {[1, 2, 3, 4].map(i => (
          <Grid key={i} size={{ xs: 12, md: 6 }}>
            <Skeleton variant="rectangular" height={250} sx={{ borderRadius: 0 }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (variant === 'cards') {
    return (
      <Grid container spacing={2}>
        {[1, 2, 3].map(i => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
            <Skeleton variant="rectangular" height={180} sx={{ borderRadius: 0 }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  // profile
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 0 }} />
      <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 0 }} />
      <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 0 }} />
    </Box>
  );
}
