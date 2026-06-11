'use client';

import { useState, type ReactNode } from 'react';
import { PlusIcon } from '../icons';
import { NavigationSidebar } from './NavigationSidebar';
import { BottomNav } from './BottomNav';
import { QuickCapture } from './QuickCapture';
import styles from './AppShell.module.css';

export function AppShell({ children }: { children: ReactNode }) {
  const [captureOpen, setCaptureOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <NavigationSidebar />

      <div className={styles.main}>
        <div className={styles.content}>{children}</div>
      </div>

      <button
        type="button"
        className={styles.fab}
        onClick={() => setCaptureOpen(true)}
        aria-label="Quick capture"
      >
        <PlusIcon size={24} />
      </button>

      <BottomNav onQuickCapture={() => setCaptureOpen(true)} />

      <QuickCapture open={captureOpen} onClose={() => setCaptureOpen(false)} />
    </div>
  );
}
