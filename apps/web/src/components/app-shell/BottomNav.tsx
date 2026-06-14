'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@lifesync/ui';
import { PlusIcon, MenuIcon } from '../icons';
import { bottomNavItems, moreNavItems, type NavItem } from './nav-items';
import { MoreSheet } from './MoreSheet';
import styles from './BottomNav.module.css';

export function BottomNav({ onQuickCapture }: { onQuickCapture: () => void }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

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

  const moreActive = moreNavItems.some(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );

  return (
    <>
      <nav className={styles.bar} aria-label="Primary">
        {bottomNavItems.slice(0, 2).map(renderLink)}

        <button type="button" className={styles.fab} onClick={onQuickCapture} aria-label="Quick capture">
          <PlusIcon size={24} />
        </button>

        {bottomNavItems.slice(2).map(renderLink)}

        <button
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

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
