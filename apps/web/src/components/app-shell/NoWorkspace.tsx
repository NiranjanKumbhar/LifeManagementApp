'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspace } from '@/lib/workspace-context';
import styles from './NoWorkspace.module.css';

/** Extract an invite token from a pasted join link or a raw token. */
function parseToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const linkMatch = trimmed.match(/\/join\/([^/?#\s]+)/);
  if (linkMatch) return linkMatch[1] ?? null;
  // A bare token has no spaces or slashes.
  if (!/[\s/]/.test(trimmed)) return trimmed;
  return null;
}

/**
 * Shown when the signed-in user belongs to no workspace (e.g. after leaving
 * their last one). Lets them create a workspace or join via an invite link.
 */
export function NoWorkspace() {
  const router = useRouter();
  const toast = useToast();
  const utils = trpc.useUtils();
  const { setActiveWorkspace } = useWorkspace();
  const [name, setName] = useState('');
  const [invite, setInvite] = useState('');

  const create = trpc.workspace.create.useMutation({
    onSuccess: (ws) => {
      void utils.workspace.mine.invalidate();
      setActiveWorkspace(ws.id);
      toast.success(`Created ${ws.name}`);
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const submitCreate = () => {
    const trimmed = name.trim();
    if (!trimmed || create.isPending) return;
    create.mutate({ name: trimmed });
  };

  const submitJoin = () => {
    const token = parseToken(invite);
    if (!token) {
      toast.error('Paste a valid invite link');
      return;
    }
    router.push(`/join/${token}`);
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>You're not in a workspace</h1>
        <p className={styles.subtitle}>
          Create your own space, or join someone else's with an invite link.
        </p>

        <form
          className={styles.section}
          onSubmit={(e) => {
            e.preventDefault();
            submitCreate();
          }}
        >
          <Input label="Workspace name" value={name} onChange={setName} placeholder="Our Home" />
          <Button type="submit" disabled={!name.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create workspace'}
          </Button>
        </form>

        <div className={styles.divider}>or</div>

        <form
          className={styles.section}
          onSubmit={(e) => {
            e.preventDefault();
            submitJoin();
          }}
        >
          <Input
            label="Invite link"
            value={invite}
            onChange={setInvite}
            placeholder="Paste an invite link"
          />
          <Button type="submit" variant="secondary" disabled={!invite.trim()}>
            Join with link
          </Button>
        </form>
      </div>
    </div>
  );
}
