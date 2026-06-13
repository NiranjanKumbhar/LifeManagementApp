'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CaptureDestination } from '@/lib/hooks/useStickyDestination';
import styles from './DestinationPicker.module.css';

export interface PickerProject {
  id: string;
  title: string;
}

export interface DestinationPickerProps {
  value: CaptureDestination;
  label: string;
  projects: PickerProject[];
  onSelect: (dest: CaptureDestination) => void;
  onNewProject: () => void;
}

export function DestinationPicker({ value, label, projects, onSelect, onNewProject }: DestinationPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? projects.filter((p) => p.title.toLowerCase().includes(q)) : projects;
  }, [projects, query]);

  const choose = (dest: CaptureDestination) => {
    onSelect(dest);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          To: <strong>{label}</strong>
        </span>
        <span aria-hidden="true" className={styles.caret}>
          ▾
        </span>
      </button>
      {open ? (
        <div className={styles.menu} aria-label="Capture destinations">
          <button
            type="button"
            aria-current={value.kind === 'inbox' ? 'true' : undefined}
            className={styles.item}
            onClick={() => choose({ kind: 'inbox' })}
          >
            Inbox
          </button>
          <button
            type="button"
            aria-current={value.kind === 'shopping' ? 'true' : undefined}
            className={styles.item}
            onClick={() => choose({ kind: 'shopping' })}
          >
            Shopping list
          </button>
          {projects.length > 0 ? <div className={styles.divider} /> : null}
          {projects.length > 5 ? (
            <input
              className={styles.search}
              type="text"
              aria-label="Search projects"
              placeholder="Search projects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          ) : null}
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-current={value.kind === 'project' && value.projectId === p.id ? 'true' : undefined}
              className={styles.item}
              onClick={() => choose({ kind: 'project', projectId: p.id })}
            >
              {p.title}
            </button>
          ))}
          <div className={styles.divider} />
          <button
            type="button"
            className={styles.newItem}
            onClick={() => {
              onNewProject();
              setOpen(false);
              setQuery('');
            }}
          >
            + New project…
          </button>
        </div>
      ) : null}
    </div>
  );
}
