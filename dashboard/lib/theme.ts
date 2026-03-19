'use client';

import { createTheme, type ThemeOptions } from '@mui/material/styles';

const palette = {
  light: {
    primary: '#0f172a',
    primaryContrast: '#ffffff',
    secondary: '#3b82f6',
    secondaryContrast: '#ffffff',
    error: '#ef4444',
    errorContrast: '#ffffff',
    warning: '#f59e0b',
    warningContrast: '#000000',
    success: '#22c55e',
    successContrast: '#ffffff',
    info: '#3b82f6',
    infoContrast: '#ffffff',
    background: '#f8fafc',
    paper: '#ffffff',
    textPrimary: '#0f172a',
    textSecondary: '#64748b',
    divider: '#e2e8f0',
    surfaceHover: '#f1f5f9',
  },
  dark: {
    primary: '#e2e8f0',
    primaryContrast: '#0f172a',
    secondary: '#60a5fa',
    secondaryContrast: '#0f172a',
    error: '#f87171',
    errorContrast: '#0f172a',
    warning: '#fbbf24',
    warningContrast: '#0f172a',
    success: '#4ade80',
    successContrast: '#0f172a',
    info: '#60a5fa',
    infoContrast: '#0f172a',
    background: '#0f172a',
    paper: '#1e293b',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    divider: '#334155',
    surfaceHover: '#1e293b',
  },
};

function buildThemeOptions(mode: 'light' | 'dark'): ThemeOptions {
  const c = mode === 'light' ? palette.light : palette.dark;

  return {
    palette: {
      mode,
      primary: { main: c.primary, contrastText: c.primaryContrast },
      secondary: { main: c.secondary, contrastText: c.secondaryContrast },
      error: { main: c.error, contrastText: c.errorContrast },
      warning: { main: c.warning, contrastText: c.warningContrast },
      success: { main: c.success, contrastText: c.successContrast },
      info: { main: c.info, contrastText: c.infoContrast },
      background: { default: c.background, paper: c.paper },
      text: { primary: c.textPrimary, secondary: c.textSecondary },
      divider: c.divider,
    },
    shape: { borderRadius: 6 },
    typography: {
      fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: { fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.025em' },
      h2: { fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.025em' },
      h3: { fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h4: { fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.01em' },
      h6: { fontSize: '1rem', fontWeight: 600 },
      subtitle1: { fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
      body1: { fontSize: '0.9375rem' },
      body2: { fontSize: '0.8125rem' },
      caption: { fontSize: '0.75rem', fontWeight: 500 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            textTransform: 'none',
            fontWeight: 600,
            padding: '6px 16px',
            fontSize: '0.8125rem',
          },
        },
        defaultProps: { disableElevation: true },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 4, fontWeight: 600, fontSize: '0.75rem' },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            border: 'none',
            backgroundImage: 'none',
          },
        },
        defaultProps: { elevation: 0 },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRadius: 0,
            borderRight: '1px solid',
            borderColor: c.divider,
          },
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: { borderRadius: 8, '&:before': { display: 'none' } },
        },
        defaultProps: { disableGutters: true, elevation: 0 },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 3, height: 6 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: c.divider, fontSize: '0.8125rem' },
        },
      },
    },
  };
}

export const lightTheme = createTheme(buildThemeOptions('light'));
export const darkTheme = createTheme(buildThemeOptions('dark'));

export const dashboardPalette = palette;
