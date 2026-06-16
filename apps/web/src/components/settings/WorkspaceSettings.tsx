'use client';

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { Avatar, Badge, Button, useToast } from '@lifesync/ui';
import { SectionCard } from './SectionCard';
import { trpc } from '@/lib/trpc';
import styles from './WorkspaceSettings.module.css';

type Workspace = inferRouterOutputs<AppRouter>['workspace']['get'];
type Member = inferRouterOutputs<AppRouter>['workspace']['members'][number];

export interface WorkspaceSettingsProps {
  workspace: Workspace | undefined;
  members: Member[];
  currentUserId: string;
  role: 'owner' | 'member' | null;
}

export function WorkspaceSettings({ workspace, members, currentUserId, role }: WorkspaceSettingsProps) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const isOwner = role === 'owner';

  const createInvite = trpc.workspace.createInvite.useMutation({
    onSuccess: (res) => {
      const url = `${window.location.origin}${res.joinPath}`;
      void navigator.clipboard.writeText(url).then(() => {
        toast.success('Invite link copied');
      });
      void utils.workspace.listInvites.invalidate();
    },
    onError: (e: { message: string }) => {
      toast.error(e.message);
    },
  });

  const listInvitesQuery = trpc.workspace.listInvites.useQuery(
    { workspaceId: workspace?.id ?? '' },
    { enabled: isOwner && Boolean(workspace?.id) },
  );

  const revokeInvite = trpc.workspace.revokeInvite.useMutation({
    onSuccess: () => {
      void utils.workspace.listInvites.invalidate();
    },
    onError: (e: { message: string }) => {
      toast.error(e.message);
    },
  });

  const invites = listInvitesQuery.data ?? [];

  return (
    <SectionCard title="Workspace">
      <div className={styles.name}>{workspace?.name ?? '—'}</div>

      <ul className={styles.members}>
        {members.map((m) => (
          <li key={m.user.id} className={styles.member}>
            <Avatar name={m.user.displayName} />
            <span className={styles.memberName}>
              {m.user.displayName}
              {m.user.id === currentUserId ? ' (you)' : ''}
            </span>
            <Badge tone={m.role === 'owner' ? 'primary' : 'neutral'}>
              {m.role === 'owner' ? 'Owner' : 'Member'}
            </Badge>
          </li>
        ))}
      </ul>

      {isOwner ? (
        <div className={styles.inviteSection}>
          <div className={styles.invite}>
            <Button
              variant="ghost"
              size="sm"
              disabled={createInvite.isPending || !workspace}
              onClick={() => {
                if (!workspace) return;
                createInvite.mutate({ workspaceId: workspace.id });
              }}
            >
              Invite
            </Button>
          </div>

          {invites.length > 0 ? (
            <ul className={styles.invites}>
              {invites.map((invite) => (
                <li key={invite.id} className={styles.inviteRow}>
                  <span className={styles.inviteEmail}>
                    {invite.email ?? 'Anyone with the link'}
                  </span>
                  <span className={styles.inviteDate}>
                    {new Date(invite.createdAt).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revokeInvite.isPending}
                    onClick={() => revokeInvite.mutate({ id: invite.id })}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
