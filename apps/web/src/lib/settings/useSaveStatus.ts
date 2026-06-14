'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useSaveStatus(): {
  status: SaveStatus;
  markSaving: () => void;
  markSaved: () => void;
  markError: () => void;
} {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const markSaving = useCallback(() => {
    clear();
    setStatus('saving');
  }, []);
  const markSaved = useCallback(() => {
    clear();
    setStatus('saved');
    timer.current = setTimeout(() => setStatus('idle'), 2000);
  }, []);
  const markError = useCallback(() => {
    clear();
    setStatus('error');
  }, []);

  return { status, markSaving, markSaved, markError };
}
