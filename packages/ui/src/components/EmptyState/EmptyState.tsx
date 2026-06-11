import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** A decorative glyph or small illustration. */
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Compact variant for inside dashboard blocks. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(styles.root, compact && styles.compact, className)}>
      {icon ? (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      ) : null}
      <p className={styles.title}>{title}</p>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
