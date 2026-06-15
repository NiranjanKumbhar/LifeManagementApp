'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type SecondNavKey = 'inbox' | 'household' | 'calendar' | 'people' | 'settings';

const STORAGE_KEY = 'ls-second-nav';
const VALID: SecondNavKey[] = ['inbox', 'household', 'calendar', 'people', 'settings'];

/** Read the persisted choice. Returns 'inbox' on the server or when unset/invalid. */
function readStored(): SecondNavKey {
  if (typeof window === 'undefined') return 'inbox';
  const stored = localStorage.getItem(STORAGE_KEY);
  return VALID.includes(stored as SecondNavKey) ? (stored as SecondNavKey) : 'inbox';
}

interface NavPrefsContextValue {
  secondNav: SecondNavKey;
  setSecondNav: (key: SecondNavKey) => void;
}

const NavPrefsContext = createContext<NavPrefsContextValue | null>(null);

export function NavPrefsProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads the persisted choice on the first client render.
  const [secondNav, setSecondNavState] = useState<SecondNavKey>(readStored);

  const setSecondNav = useCallback((next: SecondNavKey) => {
    localStorage.setItem(STORAGE_KEY, next);
    setSecondNavState(next);
  }, []);

  const value = useMemo(() => ({ secondNav, setSecondNav }), [secondNav, setSecondNav]);

  return <NavPrefsContext.Provider value={value}>{children}</NavPrefsContext.Provider>;
}

export function useSecondNav(): NavPrefsContextValue {
  const ctx = useContext(NavPrefsContext);
  if (!ctx) throw new Error('useSecondNav must be used within a NavPrefsProvider');
  return ctx;
}
