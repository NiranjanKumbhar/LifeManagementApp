'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button, EmptyState, LoadingSpinner, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspace } from '@/lib/workspace-context';
import styles from './join.module.css';

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const toast = useToast();
  const { setActiveWorkspace } = useWorkspace();

  const preview = trpc.workspace.invitePreview.useQuery({ token }, { enabled: Boolean(token) });
  const accept = trpc.workspace.acceptInvite.useMutation({
    onSuccess: (ws) => {
      setActiveWorkspace(ws.id);
      toast.success(`Joined ${ws.name}`);
      router.push('/dashboard');
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  if (preview.isLoading) {
    return (
      <div className={styles.center}>
        <LoadingSpinner size="lg" label="Loading invite" />
      </div>
    );
  }
  if (preview.isError || !preview.data || preview.data.status !== 'pending') {
    return (
      <div className={styles.center}>
        <EmptyState
          title="This invite isn't available"
          description="It may have been used, revoked, or expired."
        />
      </div>
    );
  }
  return (
    <div className={styles.center}>
      <h1 className={styles.title}>Join {preview.data.workspaceName}</h1>
      <p className={styles.subtitle}>You&apos;ve been invited to collaborate in this workspace.</p>
      <Button onClick={() => accept.mutate({ token })} disabled={accept.isPending}>
        {accept.isPending ? 'Joining…' : 'Join workspace'}
      </Button>
    </div>
  );
}
