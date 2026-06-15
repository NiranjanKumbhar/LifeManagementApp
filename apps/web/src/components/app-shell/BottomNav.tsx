'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@lifesync/ui';
import { PlusIcon, MenuIcon } from '../icons';
import { useSecondNav } from '@/lib/nav-prefs';
import {
  HOME_NAV_ITEM,
  PROJECTS_NAV_ITEM,
  SECONDARY_NAV,
  SECOND_NAV_ORDER,
  type NavItem,
} from './nav-items';
import { MoreSheet } from './MoreSheet';
import styles from './BottomNav.module.css';

export function BottomNav({ onQuickCapture }: { onQuickCapture: () => void }) {
  const pathname = usePathname();
  const { secondNav } = useSecondNav();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const closeMore = () => {
    setMoreOpen(false);
    moreButtonRef.current?.focus();
  };

  const renderLink = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(styles.tab, active && styles.active)}
        aria-current={active ? 'page' : undefined}
      >
        <span className={styles.icon}>{item.icon}</span>
        <span className={styles.label}>{item.label}</span>
      </Link>
    );
  };

  const overflowKeys = SECOND_NAV_ORDER.filter((k) => k !== secondNav);
  const moreActive = overflowKeys.some((k) => {
    const href = SECONDARY_NAV[k].href;
    return pathname === href || pathname.startsWith(`${href}/`);
  });

  return (
    <>
      <nav className={styles.bar} aria-label="Primary">
        {renderLink(HOME_NAV_ITEM)}
        {renderLink(SECONDARY_NAV[secondNav])}

        <button type="button" className={styles.fab} onClick={onQuickCapture} aria-label="Quick capture">
          <PlusIcon size={24} />
        </button>

        {renderLink(PROJECTS_NAV_ITEM)}

        <button
          ref={moreButtonRef}
          type="button"
          className={cn(styles.tab, moreActive && styles.active)}
          aria-current={moreActive ? 'page' : undefined}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <span className={styles.icon}>
            <MenuIcon />
          </span>
          <span className={styles.label}>More</span>
        </button>
      </nav>

      <MoreSheet open={moreOpen} onClose={closeMore} />
    </>
  );
}
