'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { Button, Input, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { SectionCard } from './SectionCard';
import styles from './DangerZone.module.css';

export function DangerZone({ email }: { email: string }) {
  const toast = useToast();
  const router = useRouter();
  const { signOut } = useClerk();
  const utils = trpc.useUtils();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [typed, setTyped] = useState('');

  const del = trpc.account.delete.useMutation({
    onSuccess: () => {
      void signOut({ redirectUrl: '/sign-in' });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const clear = trpc.account.clearData.useMutation({
    onSuccess: () => {
      void utils.workspace.mine.invalidate();
      toast.success('Your data was cleared');
      router.push('/dashboard');
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  return (
    <SectionCard title="Danger zone">
      <div className={styles.row}>
        <div className={styles.copy}>
          <strong>Clear my data</strong>
          <span className={styles.hint}>
            Deletes the workspaces you solely own and leaves shared ones. Your account stays.
          </span>
        </div>
        {confirmClear ? (
          <div className={styles.actions}>
            <Button variant="secondary" size="sm" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={clear.isPending} onClick={() => clear.mutate()}>
              Yes, clear
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirmClear(true)}>
            Clear my data
          </Button>
        )}
      </div>

      <div className={styles.row}>
        <div className={styles.copy}>
          <strong>Delete account</strong>
          <span className={styles.hint}>
            Permanently deletes your account, the workspaces you solely own, and removes you from
            shared ones.
          </span>
        </div>
        {confirmDelete ? null : (
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            Delete account
          </Button>
        )}
      </div>

      {confirmDelete ? (
        <div className={styles.confirm}>
          <Input label="Type your email to confirm" value={typed} onChange={setTyped} />
          <div className={styles.actions}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setConfirmDelete(false);
                setTyped('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={typed !== email || del.isPending}
              onClick={() => del.mutate()}
            >
              Permanently delete
            </Button>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
