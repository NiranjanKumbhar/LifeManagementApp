'use client';

import { UserButton } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import styles from './AccountControl.module.css';

export function AccountControl() {
  const me = trpc.user.me.useQuery();
  const name = me.data?.displayName ?? 'Your account';
  return (
    <div className={styles.account}>
      <UserButton />
      <span className={styles.name}>{name}</span>
    </div>
  );
}
