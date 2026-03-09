'use client';

import { createTheme, type ThemeOptions } from '@mui/material/styles';
import {
  argbFromHex,
  themeFromSourceColor,
  hexFromArgb,
} from '@material/material-color-utilities';

// Generate M3 palette from blue seed
const sourceColor = argbFromHex('#1565C0');
const m3Theme = themeFromSourceColor(sourceColor);

function schemeToColors(scheme: Record<string, number>) {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(scheme)) {
    result[key] = hexFromArgb(value as number);
  }
  return result;
}

const lightColors = schemeToColors(m3Theme.schemes.light.toJSON());
const darkColors = schemeToColors(m3Theme.schemes.dark.toJSON());

function buildThemeOptions(mode: 'light' | 'dark'): ThemeOptions {
  const colors = mode === 'light' ? lightColors : darkColors;

  return {
    palette: {
      mode,
      primary: {
        main: colors.primary,
        contrastText: colors.onPrimary,
      },
      secondary: {
        main: colors.secondary,
        contrastText: colors.onSecondary,
      },
      error: {
        main: colors.error,
        contrastText: colors.onError,
      },
      background: {
        default: colors.surface,
        paper: colors.surfaceContainer || colors.surface,
      },
      text: {
        primary: colors.onSurface,
        secondary: colors.onSurfaceVariant,
      },
      divider: colors.outlineVariant,
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontSize: '2.5rem', fontWeight: 400 },
      h2: { fontSize: '2rem', fontWeight: 400 },
      h3: { fontSize: '1.75rem', fontWeight: 400 },
      h4: { fontSize: '1.5rem', fontWeight: 500 },
      h5: { fontSize: '1.25rem', fontWeight: 500 },
      h6: { fontSize: '1.125rem', fontWeight: 500 },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 20,
            textTransform: 'none',
            fontWeight: 500,
            padding: '8px 24px',
          },
        },
        defaultProps: {
          disableElevation: true,
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
          },
        },
        defaultProps: {
          elevation: 0,
          variant: 'outlined',
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            textTransform: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRadius: 0,
          },
        },
      },
      MuiAppBar: {
        defaultProps: {
          elevation: 0,
        },
      },
    },
  };
}

export const lightTheme = createTheme(buildThemeOptions('light'));
export const darkTheme = createTheme(buildThemeOptions('dark'));

// Export M3 colors for custom use
export const m3Colors = { light: lightColors, dark: darkColors };
