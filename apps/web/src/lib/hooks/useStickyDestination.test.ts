import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useStickyDestination, CAPTURE_DESTINATION_KEY } from './useStickyDestination';

describe('useStickyDestination', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to inbox when nothing is stored', () => {
    const { result } = renderHook(() => useStickyDestination());
    expect(result.current[0]).toBe('inbox');
  });

  it('persists the chosen destination and re-reads it on a fresh mount', () => {
    const first = renderHook(() => useStickyDestination());
    act(() => {
      first.result.current[1]('shopping');
    });
    expect(first.result.current[0]).toBe('shopping');
    expect(window.localStorage.getItem(CAPTURE_DESTINATION_KEY)).toBe('shopping');

    const second = renderHook(() => useStickyDestination());
    expect(second.result.current[0]).toBe('shopping');
  });

  it('ignores an invalid stored value and falls back to inbox', () => {
    window.localStorage.setItem(CAPTURE_DESTINATION_KEY, 'garbage');
    const { result } = renderHook(() => useStickyDestination());
    expect(result.current[0]).toBe('inbox');
  });
});
