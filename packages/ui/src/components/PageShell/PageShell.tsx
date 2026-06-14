import type { ReactNode } from 'react';
import styles from './PageShell.module.css';

export interface PageShellProps {
  children: ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return <div className={styles.shell}>{children}</div>;
}
