'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Box,
  Divider,
  IconButton,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import ArchiveIcon from '@mui/icons-material/Archive';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PersonIcon from '@mui/icons-material/Person';
import ScienceIcon from '@mui/icons-material/Science';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import React from 'react';
import { ThemeModeContext } from './ThemeRegistry';
import RaceCountdown from './RaceCountdown';

const DRAWER_WIDTH = 220;

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { label: 'Check-In', path: '/checkin', icon: <CheckCircleOutlineIcon /> },
  { label: 'Training Plan', path: '/plan', icon: <FitnessCenterIcon /> },
  { label: 'Archive', path: '/archive', icon: <ArchiveIcon /> },
  { label: 'Trends', path: '/trends', icon: <TrendingUpIcon /> },
  { label: 'DEXA Scans', path: '/dexa', icon: <ScienceIcon /> },
  { label: 'Races', path: '/races', icon: <EmojiEventsIcon /> },
  { label: 'Profile', path: '/profile', icon: <PersonIcon /> },
];

/** Shared drawer content used by both permanent and temporary variants. */
function DrawerContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, toggleMode } = React.useContext(ThemeModeContext);

  return (
    <>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
          <Typography variant="h6" noWrap sx={{ fontWeight: 700, flex: 1 }}>
            OCR Coach
          </Typography>
          <IconButton onClick={toggleMode} size="small" aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
            {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
          </IconButton>
        </Box>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1 }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.path === '/'
              ? pathname === '/'
              : pathname.startsWith(item.path);
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => {
                  router.push(item.path);
                  onItemClick?.();
                }}
                sx={{
                  borderRadius: 2,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                    '&:hover': { bgcolor: 'primary.dark' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ mt: 'auto', p: 2 }}>
        <RaceCountdown />
      </Box>
    </>
  );
}

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const drawerSx = {
    width: DRAWER_WIDTH,
    flexShrink: 0,
    '& .MuiDrawer-paper': {
      width: DRAWER_WIDTH,
      boxSizing: 'border-box' as const,
    },
  };

  return (
    <>
      {/* Mobile: temporary drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          ...drawerSx,
        }}
      >
        <DrawerContent onItemClick={onMobileClose} />
      </Drawer>

      {/* Desktop: permanent drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          ...drawerSx,
        }}
      >
        <DrawerContent />
      </Drawer>
    </>
  );
}

export { DRAWER_WIDTH };
