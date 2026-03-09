'use client';

import * as React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { CacheProvider } from '@emotion/react';
import type { EmotionCache } from '@emotion/cache';
import createCache from '@emotion/cache';
import { useServerInsertedHTML } from 'next/navigation';
import { lightTheme, darkTheme } from '@/lib/theme';

interface ThemeRegistryProps {
  children: React.ReactNode;
}

// Intercept Emotion's insert to track new style names for SSR extraction.
// This prevents inline <style> tags from appearing in the component tree
// (which causes hydration mismatches).
function createEmotionCacheWithFlush() {
  const cache = createCache({ key: 'mui' });
  cache.compat = true;
  const prevInsert = cache.insert;
  let inserted: string[] = [];

  cache.insert = (...args) => {
    const serialized = args[1];
    if (cache.inserted[serialized.name] === undefined) {
      inserted.push(serialized.name);
    }
    return prevInsert(...args);
  };

  const flush = () => {
    const prevInserted = inserted;
    inserted = [];
    return prevInserted;
  };

  return { cache, flush };
}

export default function ThemeRegistry({ children }: ThemeRegistryProps) {
  const [mode, setMode] = React.useState<'light' | 'dark'>('light');
  const [{ cache, flush }] = React.useState(createEmotionCacheWithFlush);

  React.useEffect(() => {
    const saved = localStorage.getItem('theme-mode');
    if (saved === 'dark' || saved === 'light') {
      setMode(saved);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setMode('dark');
    }
  }, []);

  const toggleMode = React.useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme-mode', next);
      return next;
    });
  }, []);

  useServerInsertedHTML(() => {
    const names = flush();
    if (names.length === 0) return null;
    let styles = '';
    for (const name of names) {
      const val = cache.inserted[name];
      if (typeof val === 'string') {
        styles += val;
      } else {
        // Boolean true means it was already inserted via <style> tag
        // We still need to include the name in data-emotion for rehydration
      }
    }
    if (!styles) return null;
    return (
      <style
        key={cache.key}
        data-emotion={`${cache.key} ${names.join(' ')}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  const theme = mode === 'light' ? lightTheme : darkTheme;

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode }}>
      <CacheProvider value={cache}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </CacheProvider>
    </ThemeModeContext.Provider>
  );
}

export const ThemeModeContext = React.createContext({
  mode: 'light' as 'light' | 'dark',
  toggleMode: () => {},
});
