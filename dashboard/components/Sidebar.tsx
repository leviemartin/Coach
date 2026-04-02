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
  Typography,
  Box,
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
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import React from 'react';
import { ThemeModeContext } from './ThemeRegistry';
import RaceCountdown from './RaceCountdown';
import { borders } from '@/lib/design-tokens';

const DRAWER_WIDTH = 220;

const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
      { label: 'Daily Log', path: '/log', icon: <EditNoteIcon /> },
      { label: 'Check-In', path: '/checkin', icon: <CheckCircleOutlineIcon /> },
      { label: 'Training Plan', path: '/plan', icon: <FitnessCenterIcon /> },
      { label: 'Session', path: '/session', icon: <PlayArrowIcon /> },
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

/** Section header: JetBrains Mono 9px, uppercase, 2px letter spacing, muted */
const sectionLabelSx = {
  fontFamily: '"JetBrains Mono", monospace',
  fontSize: '9px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '2px',
  color: 'text.secondary',
  px: 2,
  pt: 1.5,
  pb: 0.5,
};

/** Shared drawer content used by both permanent and temporary variants. */
function DrawerContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { mode, toggleMode } = React.useContext(ThemeModeContext);
  const { data: session } = useSession();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* App title bar — Libre Franklin 900, uppercase, hard bottom border */}
      <Box sx={{
        px: 2,
        py: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderBottom: `2px solid ${borders.hard}`,
        minHeight: 56,
      }}>
        <Typography
          noWrap
          sx={{
            fontFamily: '"Libre Franklin", sans-serif',
            fontSize: '14px',
            fontWeight: 900,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            flex: 1,
          }}
        >
          OCR Coach
        </Typography>
        <IconButton
          onClick={toggleMode}
          size="small"
          aria-label={mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          sx={{ borderRadius: 0, border: `1px solid ${borders.soft}`, width: 32, height: 32 }}
        >
          {mode === 'light' ? <DarkModeIcon sx={{ fontSize: 16 }} /> : <LightModeIcon sx={{ fontSize: 16 }} />}
        </IconButton>
      </Box>

      {/* Nav sections — hard borders between groups, no rounded corners */}
      <List sx={{ px: 0, overflowY: 'auto', flex: 1 }}>
        {NAV_SECTIONS.map((section, sectionIndex) => (
          <React.Fragment key={section.label}>
            {sectionIndex > 0 && (
              <Box sx={{ borderTop: `2px solid ${borders.hard}` }} />
            )}
            <Typography sx={sectionLabelSx}>
              {section.label}
            </Typography>
            {section.items.map((item) => {
              const isActive =
                item.path === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.path);
              return (
                <ListItem key={item.path} disablePadding>
                  <ListItemButton
                    selected={isActive}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      router.push(item.path);
                      onItemClick?.();
                    }}
                    sx={{
                      borderRadius: 0,
                      py: 0.75,
                      px: 2,
                      borderBottom: `1px solid ${borders.soft}`,
                      '&.Mui-selected': {
                        bgcolor: 'transparent',
                        borderLeft: `3px solid ${borders.hard}`,
                        '& .MuiListItemIcon-root': { color: 'text.primary' },
                        '& .MuiListItemText-primary': { fontWeight: 700 },
                        '&:hover': { bgcolor: 'action.hover' },
                      },
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>{item.icon}</ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        sx: {
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: '12px',
                          fontWeight: isActive ? 700 : 400,
                        },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </React.Fragment>
        ))}
      </List>

      {/* Bottom section — race countdown + user */}
      <Box sx={{ mt: 'auto', p: 1.5, borderTop: `2px solid ${borders.hard}` }}>
        <RaceCountdown />
        {session?.user && (
          <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, pt: 1.5, borderTop: `1px solid ${borders.soft}` }}>
            <Avatar
              src={session.user.image || undefined}
              alt={session.user.name || ''}
              sx={{ width: 28, height: 28, borderRadius: 0 }}
            />
            <Typography
              noWrap
              sx={{
                flex: 1,
                fontFamily: '"JetBrains Mono", monospace',
                fontSize: '11px',
                fontWeight: 500,
              }}
            >
              {session.user.name || session.user.email}
            </Typography>
            <IconButton
              size="small"
              onClick={() => signOut()}
              aria-label="Sign out"
              sx={{ borderRadius: 0, width: 28, height: 28 }}
            >
              <LogoutIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
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
