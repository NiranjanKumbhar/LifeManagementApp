'use client';

import { useEffect, useRef, useState } from 'react';
import type { StockStatus } from '@lifesync/shared-types';
import { Badge } from '@lifesync/ui';
import { HOUSEHOLD_STATUS_META } from '@/lib/household/category-meta';
import styles from './StatusPillMenu.module.css';

const ALL_STATUSES: StockStatus[] = ['stocked', 'low', 'out', 'on_list'];

export interface StatusPillMenuProps {
  status: StockStatus;
  onSelect: (status: StockStatus) => void;
}

export function StatusPillMenu({ status, onSelect }: StatusPillMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const meta = HOUSEHOLD_STATUS_META[status];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <span aria-hidden="true" className={styles.caret}>
          ▾
        </span>
      </button>
      {open ? (
        <ul className={styles.menu} role="menu">
          {ALL_STATUSES.map((s) => (
            <li key={s} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={s === status}
                className={styles.item}
                onClick={() => {
                  onSelect(s);
                  setOpen(false);
                }}
              >
                {HOUSEHOLD_STATUS_META[s].label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
