import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSaveStatus } from './useSaveStatus';

describe('useSaveStatus', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('transitions idle → saving → saved → idle', () => {
    const { result } = renderHook(() => useSaveStatus());
    expect(result.current.status).toBe('idle');
    act(() => result.current.markSaving());
    expect(result.current.status).toBe('saving');
    act(() => result.current.markSaved());
    expect(result.current.status).toBe('saved');
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.status).toBe('idle');
  });

  it('markError sets error', () => {
    const { result } = renderHook(() => useSaveStatus());
    act(() => result.current.markError());
    expect(result.current.status).toBe('error');
  });
});
