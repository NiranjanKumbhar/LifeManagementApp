import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NavPrefsProvider, useSecondNav } from './nav-prefs';

const wrapper = ({ children }: { children: ReactNode }) => (
  <NavPrefsProvider>{children}</NavPrefsProvider>
);

describe('nav-prefs', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to inbox', () => {
    const { result } = renderHook(() => useSecondNav(), { wrapper });
    expect(result.current.secondNav).toBe('inbox');
  });

  it('persists and updates the selection', () => {
    const { result } = renderHook(() => useSecondNav(), { wrapper });
    act(() => result.current.setSecondNav('calendar'));
    expect(result.current.secondNav).toBe('calendar');
    expect(localStorage.getItem('ls-second-nav')).toBe('calendar');
  });

  it('reads a stored value', () => {
    localStorage.setItem('ls-second-nav', 'people');
    const { result } = renderHook(() => useSecondNav(), { wrapper });
    expect(result.current.secondNav).toBe('people');
  });

  it('falls back to inbox for an invalid stored value', () => {
    localStorage.setItem('ls-second-nav', 'bogus');
    const { result } = renderHook(() => useSecondNav(), { wrapper });
    expect(result.current.secondNav).toBe('inbox');
  });
});
