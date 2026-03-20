'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
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
import Avatar from '@mui/material/Avatar';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import ArchiveIcon from '@mui/icons-material/Archive';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PersonIcon from '@mui/icons-material/Person';
import ScienceIcon from '@mui/icons-material/Science';
import EditNoteIcon from '@mui/icons-material/EditNote';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import React from 'react';
import { ThemeModeContext } from './ThemeRegistry';
import RaceCountdown from './RaceCountdown';

const DRAWER_WIDTH = 220;

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
      { label: 'Check-In', path: '/checkin', icon: <CheckCircleOutlineIcon /> },
      { label: 'Daily Log', path: '/log', icon: <EditNoteIcon /> },
      { label: 'Training Plan', path: '/plan', icon: <FitnessCenterIcon /> },
    ],
  },
  {
    label: 'Data',
    items: [
      { label: 'Archive', path: '/archive', icon: <ArchiveIcon /> },
      { label: 'Trends', path: '/trends', icon: <TrendingUpIcon /> },
      { label: 'DEXA Scans', path: '/dexa', icon: <ScienceIcon /> },
    ],
  },
  {
    label: 'Meta',
    items: [
      { label: 'Races', path: '/races', icon: <EmojiEventsIcon /> },
      { label: 'Profile', path: '/profile', icon: <PersonIcon /> },
    ],
  },
];

const sectionLabelSx = {
  px: 2,
  pt: 1.5,
  pb: 0.5,
  fontWeight: 600,
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
};

/** Shared drawer content used by both permanent and temporary variants. */
function DrawerContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, toggleMode } = React.useContext(ThemeModeContext);
  const { data: session } = useSession();

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
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <React.Fragment key={section.label}>
            {sectionIndex > 0 && <Divider sx={{ my: 0.5 }} />}
            <Typography variant="caption" color="text.secondary" sx={sectionLabelSx}>
              {section.label}
            </Typography>
            {section.items.map((item) => {
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
                      borderRadius: 1,
                      '&.Mui-selected': {
                        bgcolor: 'action.selected',
                        color: 'secondary.main',
                        '& .MuiListItemIcon-root': { color: 'secondary.main' },
                        '&:hover': { bgcolor: 'action.hover' },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </React.Fragment>
        ))}
      </List>
      <Box sx={{ mt: 'auto', p: 2 }}>
        <RaceCountdown />
      </Box>
      {session?.user && (
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar
            src={session.user.image || undefined}
            alt={session.user.name || ''}
            sx={{ width: 32, height: 32 }}
          />
          <Typography variant="body2" sx={{ flex: 1 }} noWrap>
            {session.user.name || session.user.email}
          </Typography>
          <IconButton size="small" onClick={() => signOut()} aria-label="Sign out">
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Box>
      )}
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
