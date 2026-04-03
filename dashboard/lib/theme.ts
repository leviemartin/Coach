'use client';

import { createTheme, type ThemeOptions } from '@mui/material/styles';

const palette = {
  light: {
    primary: '#18181b',
    primaryContrast: '#fafaf7',
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
    background: '#f5f5f0',
    paper: '#fafaf7',
    textPrimary: '#18181b',
    textSecondary: '#71717a',
    divider: '#e4e4e0',
    surfaceHover: '#f0f0eb',
  },
  dark: {
    primary: '#e4e4e7',
    primaryContrast: '#0a0a0f',
    secondary: '#60a5fa',
    secondaryContrast: '#0a0a0f',
    error: '#f87171',
    errorContrast: '#0a0a0f',
    warning: '#fbbf24',
    warningContrast: '#0a0a0f',
    success: '#4ade80',
    successContrast: '#0a0a0f',
    info: '#60a5fa',
    infoContrast: '#0a0a0f',
    background: '#0a0a0f',
    paper: '#111116',
    textPrimary: '#e4e4e7',
    textSecondary: '#71717a',
    divider: '#27272a',
    surfaceHover: '#1a1a1f',
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
    shape: { borderRadius: 0 },
    typography: {
      fontFamily: '"DM Sans", sans-serif',
      h1: { fontFamily: '"Libre Franklin", sans-serif', fontSize: '1.75rem', fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '-0.5px' },
      h2: { fontFamily: '"Libre Franklin", sans-serif', fontSize: '1.5rem', fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '-0.5px' },
      h3: { fontFamily: '"Libre Franklin", sans-serif', fontSize: '1.375rem', fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '-0.5px' },
      h4: { fontFamily: '"Libre Franklin", sans-serif', fontSize: '1.125rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
      h5: { fontFamily: '"Libre Franklin", sans-serif', fontSize: '1rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
      h6: { fontFamily: '"Libre Franklin", sans-serif', fontSize: '0.875rem', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.5px' },
      subtitle1: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, fontSize: '0.8125rem' },
      subtitle2: { fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, fontSize: '0.75rem' },
      body1: { fontSize: '0.875rem' },
      body2: { fontFamily: '"JetBrains Mono", monospace', fontSize: '0.8125rem' },
      caption: {
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: '0.625rem',
        fontWeight: 700,
        textTransform: 'uppercase' as const,
        letterSpacing: '2px',
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            textTransform: 'uppercase' as const,
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 700,
            letterSpacing: '1px',
            padding: '8px 20px',
            fontSize: '0.75rem',
          },
        },
        defaultProps: { disableElevation: true },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            fontFamily: '"JetBrains Mono", monospace',
            fontWeight: 700,
            fontSize: '0.625rem',
            letterSpacing: '1px',
            textTransform: 'uppercase' as const,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            border: `3px solid ${c.primary}`,
            backgroundImage: 'none',
            boxShadow: 'none',
          },
        },
        defaultProps: { elevation: 0 },
        variants: [
          {
            props: { variant: 'outlined' },
            style: {
              border: `3px solid ${c.primary}`,
            },
          },
        ],
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none', borderRadius: 0 },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRadius: 0,
            borderRight: `2px solid ${c.primary}`,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 0,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '0.875rem',
            },
          },
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            border: `3px solid ${c.primary}`,
            '&:before': { display: 'none' },
          },
        },
        defaultProps: { disableGutters: true, elevation: 0 },
      },
      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 0, height: 6 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: c.divider, fontSize: '0.8125rem', fontFamily: '"JetBrains Mono", monospace' },
        },
      },
    },
  };
}

export const lightTheme = createTheme(buildThemeOptions('light'));
export const darkTheme = createTheme(buildThemeOptions('dark'));

export const dashboardPalette = palette;

export const cardContentSx = {
  pb: '12px !important',
  pt: 1.5,
  px: { xs: 1.5, sm: 2 },
};
