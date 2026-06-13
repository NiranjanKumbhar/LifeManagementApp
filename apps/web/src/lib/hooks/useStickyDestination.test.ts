import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useStickyDestination, CAPTURE_DESTINATION_KEY } from './useStickyDestination';

describe('useStickyDestination', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to inbox when nothing is stored', () => {
    const { result } = renderHook(() => useStickyDestination());
    expect(result.current[0]).toEqual({ kind: 'inbox' });
  });

  it('persists shopping and re-reads it on a fresh mount', () => {
    const first = renderHook(() => useStickyDestination());
    act(() => first.result.current[1]({ kind: 'shopping' }));
    expect(window.localStorage.getItem(CAPTURE_DESTINATION_KEY)).toBe('shopping');
    const second = renderHook(() => useStickyDestination());
    expect(second.result.current[0]).toEqual({ kind: 'shopping' });
  });

  it('round-trips a project destination', () => {
    const first = renderHook(() => useStickyDestination());
    act(() => first.result.current[1]({ kind: 'project', projectId: 'p1' }));
    expect(window.localStorage.getItem(CAPTURE_DESTINATION_KEY)).toBe('project:p1');
    const second = renderHook(() => useStickyDestination());
    expect(second.result.current[0]).toEqual({ kind: 'project', projectId: 'p1' });
  });

  it('falls back to inbox for an invalid stored value', () => {
    window.localStorage.setItem(CAPTURE_DESTINATION_KEY, 'garbage');
    const { result } = renderHook(() => useStickyDestination());
    expect(result.current[0]).toEqual({ kind: 'inbox' });
  });
});
