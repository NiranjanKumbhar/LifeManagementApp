import { cn } from '../../utils/cn';
import styles from './PartnerBadge.module.css';

export type Ownership = 'mine' | 'partner' | 'shared';

export interface PartnerBadgeProps {
  ownership: Ownership;
  /** Optional name to personalise the partner/mine label. */
  name?: string;
  className?: string;
}

const LABELS: Record<Ownership, string> = {
  mine: 'Mine',
  partner: 'Partner',
  shared: 'Shared',
};

export function PartnerBadge({ ownership, name, className }: PartnerBadgeProps) {
  const label = ownership === 'shared' ? LABELS.shared : (name ?? LABELS[ownership]);
  return (
    <span className={cn(styles.badge, styles[ownership], className)}>
      <span className={styles.dot} aria-hidden="true" />
      {label}
    </span>
  );
}
