'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@lifesync/ui';
import { PlusIcon } from '../icons';
import { bottomNavItems, type NavItem } from './nav-items';
import styles from './BottomNav.module.css';

export function BottomNav({ onQuickCapture }: { onQuickCapture: () => void }) {
  const pathname = usePathname();

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

  return (
    <nav className={styles.bar} aria-label="Primary">
      {bottomNavItems.slice(0, 2).map(renderLink)}

      <button
        type="button"
        className={styles.fab}
        onClick={onQuickCapture}
        aria-label="Quick capture"
      >
        <PlusIcon size={24} />
      </button>

      {bottomNavItems.slice(2).map(renderLink)}
    </nav>
  );
}
