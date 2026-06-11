'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { cn } from '@lifesync/ui';
import { navItems } from './nav-items';
import styles from './NavigationSidebar.module.css';

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavigationSidebar() {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar} aria-label="Main navigation">
      <Link href="/dashboard" className={styles.brand}>
        <span className={styles.brandMark} aria-hidden="true" />
        <span className={styles.brandName}>LifeSync</span>
      </Link>

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(styles.link, active && styles.active)}
              aria-current={active ? 'page' : undefined}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={styles.footer}>
        <UserButton />
        <span className={styles.footerHint}>Your account</span>
      </div>
    </aside>
  );
}
