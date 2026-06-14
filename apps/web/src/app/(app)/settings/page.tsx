'use client';

import { EmptyState, LoadingSpinner, PageHeader, PageShell } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { WorkspaceSettings } from '@/components/settings/WorkspaceSettings';
import styles from './settings.module.css';

export default function SettingsPage() {
  const workspaceId = useWorkspaceId();
  const enabled = Boolean(workspaceId);

  const meQuery = trpc.user.me.useQuery();
  const workspaceQuery = trpc.workspace.get.useQuery({ id: workspaceId ?? '' }, { enabled });
  const membersQuery = trpc.workspace.members.useQuery({ workspaceId: workspaceId ?? '' }, { enabled });

  if (meQuery.isLoading) {
    return (
      <div className={styles.center}>
        <LoadingSpinner size="lg" label="Loading settings" />
      </div>
    );
  }
  if (meQuery.isError || !meQuery.data) {
    return (
      <div className={styles.center}>
        <EmptyState title="We couldn't load your settings" description="Make sure the API is running." />
      </div>
    );
  }

  const me = meQuery.data;

  return (
    <PageShell>
      <PageHeader title="Settings" />
      <ProfileSettings me={me} />
      <NotificationSettings me={me} />
      <WorkspaceSettings
        workspace={workspaceQuery.data}
        members={membersQuery.data ?? []}
        currentUserId={me.id}
      />
    </PageShell>
  );
}
