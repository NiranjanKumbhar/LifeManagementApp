'use client';

import { EmptyState, LoadingSpinner, PageHeader, PageShell } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { InboxItemRow } from '@/components/inbox/InboxItemRow';
import styles from './inbox.module.css';

export default function InboxPage() {
  const workspaceId = useWorkspaceId();
  const enabled = Boolean(workspaceId);
  const wsInput = { workspaceId: workspaceId ?? '' };
  const utils = trpc.useUtils();

  const inbox = trpc.inbox.list.useQuery(wsInput, { enabled });
  const projects = trpc.project.list.useQuery({ ...wsInput, status: 'active' }, { enabled });

  const refresh = () => {
    if (workspaceId) void utils.inbox.list.invalidate({ workspaceId });
  };
  const assign = trpc.inbox.assignToProject.useMutation({ onSuccess: refresh });
  const dismiss = trpc.inbox.dismiss.useMutation({ onSuccess: refresh });
  const busy = assign.isPending || dismiss.isPending;

  return (
    <PageShell>
      <PageHeader title="Inbox" subtitle="Everything you've captured, ready to sort." />

      {inbox.isLoading ? (
        <div className={styles.center}>
          <LoadingSpinner size="lg" label="Loading your inbox" />
        </div>
      ) : inbox.isError || !inbox.data ? (
        <div className={styles.center}>
          <EmptyState
            title="We couldn't load your inbox"
            description={
              workspaceId ? 'Make sure the API is running.' : 'No workspace is configured yet.'
            }
          />
        </div>
      ) : inbox.data.length === 0 ? (
        <div className={styles.center}>
          <EmptyState
            title="Inbox zero ✨"
            description="Nothing to sort. Capture a thought any time with the + button."
          />
        </div>
      ) : (
        <ul className={styles.list}>
          {inbox.data.map((item) => (
            <InboxItemRow
              key={item.id}
              item={item}
              projects={projects.data ?? []}
              busy={busy}
              onAssign={(projectId) => assign.mutate({ id: item.id, projectId })}
              onDismiss={() => dismiss.mutate({ id: item.id })}
            />
          ))}
        </ul>
      )}
    </PageShell>
  );
}
