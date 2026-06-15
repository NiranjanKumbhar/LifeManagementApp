import type { UserRef } from '@lifesync/shared-types';
import { Avatar } from '../Avatar/Avatar';
import styles from './UserChip.module.css';

export interface UserChipProps {
  user: UserRef | null;
  label?: string;
}

export function UserChip({ user, label }: UserChipProps) {
  if (!user) return <span className={styles.empty}>{label ? `${label} —` : '—'}</span>;
  const firstName = user.displayName.split(' ')[0] || user.displayName;
  return (
    <span className={styles.chip}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
      <span className={styles.name}>{firstName}</span>
    </span>
  );
}
