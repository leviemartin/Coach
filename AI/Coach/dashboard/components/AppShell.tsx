'use client';

import React, { useState } from 'react';
import { Box, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import Sidebar, { DRAWER_WIDTH } from './Sidebar';

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
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <MenuIcon />
      </IconButton>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, sm: 2, md: 3 },
          pt: { xs: 7, sm: 7, md: 3 },
          ml: { xs: 0, md: `${DRAWER_WIDTH}px` },
          maxWidth: { xs: '100%', md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
