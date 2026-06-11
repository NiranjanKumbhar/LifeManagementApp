import type { UrgencyLevel } from '@lifesync/shared-types';
import { cn } from '../../utils/cn';
import { urgencyStyle } from '../../utils/urgency-color';
import styles from './UrgencyIndicator.module.css';

export interface UrgencyIndicatorProps {
  level: UrgencyLevel;
  showLabel?: boolean;
  className?: string;
}

export function UrgencyIndicator({ level, showLabel = true, className }: UrgencyIndicatorProps) {
  const style = urgencyStyle(level);
  return (
    <span
      className={cn(styles.root, className)}
      style={{ color: style.color }}
      data-level={level}
    >
      <span
        className={cn(styles.dot, level === 'overdue' && styles.pulse)}
        aria-hidden={showLabel}
        aria-label={showLabel ? undefined : style.label}
        role={showLabel ? undefined : 'img'}
      />
      {showLabel ? <span className={styles.label}>{style.label}</span> : null}
    </span>
  );
}
