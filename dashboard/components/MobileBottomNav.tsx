'use client';

import { usePathname, useRouter } from 'next/navigation';
import { BottomNavigation, BottomNavigationAction, Box } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EditNoteIcon from '@mui/icons-material/EditNote';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import { borders } from '@/lib/design-tokens';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { label: 'Session', path: '/session', icon: <PlayArrowIcon /> },
  { label: 'Log', path: '/log', icon: <EditNoteIcon /> },
  { label: 'Plan', path: '/plan', icon: <FitnessCenterIcon /> },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const currentIndex = NAV_ITEMS.findIndex((item) =>
    item.path === '/' ? pathname === '/' : pathname.startsWith(item.path),
  );

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: { xs: 'block', md: 'none' },
        zIndex: 1200,
        borderTop: `3px solid ${borders.hard}`,
        bgcolor: 'background.paper',
      }}
    >
      <BottomNavigation
        value={currentIndex}
        onChange={(_, newValue) => {
          router.push(NAV_ITEMS[newValue].path);
        }}
        showLabels
        sx={{
          height: 56,
          bgcolor: 'background.paper',
          '& .MuiBottomNavigationAction-root': {
            minWidth: 0,
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            color: 'text.secondary',
            borderRadius: 0,
          },
          '& .Mui-selected': {
            color: `${borders.hard} !important`,
            fontWeight: 700,
          },
        }}
      >
        {NAV_ITEMS.map((item) => (
          <BottomNavigationAction
            key={item.path}
            label={item.label}
            icon={item.icon}
          />
        ))}
      </BottomNavigation>
    </Box>
  );
}
