'use client';

import { useCallback, useEffect, useState } from 'react';

export type CaptureDestination =
  | { kind: 'inbox' }
  | { kind: 'shopping' }
  | { kind: 'project'; projectId: string };

export const CAPTURE_DESTINATION_KEY = 'lifesync.capture.destination';

function serialize(dest: CaptureDestination): string {
  return dest.kind === 'project' ? `project:${dest.projectId}` : dest.kind;
}

function parse(raw: string | null): CaptureDestination {
  if (raw === 'inbox') return { kind: 'inbox' };
  if (raw === 'shopping') return { kind: 'shopping' };
  if (raw && raw.startsWith('project:')) {
    const projectId = raw.slice('project:'.length);
    if (projectId) return { kind: 'project', projectId };
  }
  return { kind: 'inbox' };
}

/**
 * The Quick Capture destination, remembered across sessions in localStorage.
 * SSR-safe: starts at inbox and adopts the stored value after mount.
 */
export function useStickyDestination(): [CaptureDestination, (next: CaptureDestination) => void] {
  const [destination, setDestination] = useState<CaptureDestination>({ kind: 'inbox' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDestination(parse(window.localStorage.getItem(CAPTURE_DESTINATION_KEY)));
  }, []);

  const set = useCallback((next: CaptureDestination) => {
    setDestination(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CAPTURE_DESTINATION_KEY, serialize(next));
    }
  }, []);

  return [destination, set];
}
