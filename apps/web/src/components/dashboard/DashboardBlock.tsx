import type { CSSProperties, ReactNode } from 'react';
import { Card, cn } from '@lifesync/ui';
import styles from './DashboardBlock.module.css';

export type BlockAccent = 'overdue' | 'soon' | 'primary' | 'partner' | 'completed' | 'neutral';

export interface DashboardBlockProps {
  title: string;
  icon: ReactNode;
  count?: number;
  accent?: BlockAccent;
  children: ReactNode;
  style?: CSSProperties;
}

export function DashboardBlock({
  title,
  icon,
  count,
  accent = 'neutral',
  children,
  style,
}: DashboardBlockProps) {
  return (
    <Card as="section" className={cn(styles.block, styles[accent])} style={style}>
      <header className={styles.header}>
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
        <h2 className={styles.title}>{title}</h2>
        {typeof count === 'number' && count > 0 ? (
          <span className={styles.count}>{count}</span>
        ) : null}
      </header>
      <div className={styles.body}>{children}</div>
    </Card>
  );
}
