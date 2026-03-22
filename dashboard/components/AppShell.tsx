'use client';

import React, { useState } from 'react';
import { Box, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import Sidebar, { DRAWER_WIDTH } from './Sidebar';
import MobileBottomNav from './MobileBottomNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      {/* Hamburger — visible on xs/sm only, toggles drawer */}
      <IconButton
        aria-label="Open navigation menu"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((prev) => !prev)}
        sx={{
          display: mobileOpen ? 'none' : { xs: 'flex', md: 'none' },
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: (theme) => theme.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          boxShadow: 1,
          minWidth: 48,
          minHeight: 48,
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <MenuIcon />
      </IconButton>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          overflowX: 'hidden',
          p: { xs: 2, sm: 2, md: 2.5 },
          pt: { xs: 7, sm: 7, md: 2.5 },
          pb: { xs: '72px', md: 2.5 },
        }}
      >
        {children}
      </Box>

      <MobileBottomNav />
    </Box>
  );
}
