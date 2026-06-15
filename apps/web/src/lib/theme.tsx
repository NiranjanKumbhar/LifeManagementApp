'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'ls-theme';

/** Read the persisted choice. Returns 'system' on the server or when unset/invalid. */
function readStored(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// NOTE: keep this resolution logic in sync with the inline no-flash script in
// apps/web/src/app/layout.tsx (same storage key + same system→OS fallback).
function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

function apply(mode: ThemeMode): void {
  document.documentElement.dataset.theme = resolve(mode);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads the persisted choice on the first client render, so the
  // mode (and applied theme) is correct immediately — no post-mount flash.
  const [mode, setModeState] = useState<ThemeMode>(readStored);

  // Apply the theme; while in "system" mode, follow OS changes live.
  useEffect(() => {
    apply(mode);
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
