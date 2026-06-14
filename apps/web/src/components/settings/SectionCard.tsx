'use client';

import type { ReactNode } from 'react';
import type { SaveStatus } from '@/lib/settings/useSaveStatus';
import styles from './SectionCard.module.css';

export interface SectionCardProps {
  title: string;
  status?: SaveStatus;
  children: ReactNode;
}

export function SectionCard({ title, status, children }: SectionCardProps) {
  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {status === 'saving' ? (
          <span className={styles.saving}>Saving…</span>
        ) : status === 'saved' ? (
          <span className={styles.saved}>Saved ✓</span>
        ) : null}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
