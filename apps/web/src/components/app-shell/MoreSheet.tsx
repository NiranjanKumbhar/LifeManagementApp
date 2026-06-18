'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@lifesync/ui';
import { useSecondNav } from '@/lib/nav-prefs';
import { SECONDARY_NAV, SECOND_NAV_ORDER } from './nav-items';
import { AccountControl } from './AccountControl';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { useWorkspace } from '@/lib/workspace-context';
import styles from './MoreSheet.module.css';

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const pathname = usePathname();
  const { secondNav } = useSecondNav();
  const { workspaces } = useWorkspace();
  if (!open) return null;

  const items = SECOND_NAV_ORDER.filter((k) => k !== secondNav).map((k) => SECONDARY_NAV[k]);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="More">
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        {workspaces.length > 1 && (
          <div className={styles.workspaceSection}>
            <WorkspaceSwitcher />
          </div>
        )}
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(styles.row, active && styles.active)}
              onClick={onClose}
            >
              <span className={styles.icon} aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
        <div className={styles.accountFooter}>
          <AccountControl />
        </div>
      </div>
    </div>
  );
}
