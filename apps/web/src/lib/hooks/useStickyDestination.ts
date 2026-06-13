'use client';

import { useCallback, useEffect, useState } from 'react';

export type CaptureDestination = 'inbox' | 'shopping';

export const CAPTURE_DESTINATION_KEY = 'lifesync.capture.destination';

function isDestination(value: string | null): value is CaptureDestination {
  return value === 'inbox' || value === 'shopping';
}

/**
 * The Quick Capture destination, remembered across sessions in localStorage.
 * SSR-safe: starts at 'inbox' and adopts the stored value after mount.
 */
export function useStickyDestination(): [CaptureDestination, (next: CaptureDestination) => void] {
  const [destination, setDestination] = useState<CaptureDestination>('inbox');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(CAPTURE_DESTINATION_KEY);
    if (isDestination(stored)) setDestination(stored);
  }, []);

  const set = useCallback((next: CaptureDestination) => {
    setDestination(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CAPTURE_DESTINATION_KEY, next);
    }
  }, []);

  return [destination, set];
}
