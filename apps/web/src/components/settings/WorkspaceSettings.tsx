'use client';

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const utils = trpc.useUtils();
  const isOwner = role === 'owner';
  const ownerCount = members.filter((m) => m.role === 'owner').length;
  const wsId = workspace?.id;

  const refreshMembers = () => {
    void utils.workspace.members.invalidate();
    void utils.workspace.mine.invalidate();
  };
  const onError = (e: { message: string }) => toast.error(e.message);

  const createInvite = trpc.workspace.createInvite.useMutation({
    onSuccess: (res) => {
      const url = `${window.location.origin}${res.joinPath}`;
      void navigator.clipboard.writeText(url).then(() => toast.success('Invite link copied'));
      void utils.workspace.listInvites.invalidate();
    },
    onError,
  });
  const listInvitesQuery = trpc.workspace.listInvites.useQuery(
    { workspaceId: wsId ?? '' },
    { enabled: isOwner && Boolean(wsId) },
  );
  const revokeInvite = trpc.workspace.revokeInvite.useMutation({
    onSuccess: () => void utils.workspace.listInvites.invalidate(),
    onError,
  });

  const changeRole = trpc.workspace.changeRole.useMutation({
    onSuccess: () => {
      refreshMembers();
      toast.success('Role updated');
    },
    onError,
  });
  const removeMember = trpc.workspace.removeMember.useMutation({
    onSuccess: () => {
      refreshMembers();
      toast.success('Member removed');
    },
    onError,
  });
  const leave = trpc.workspace.leave.useMutation({
    onSuccess: () => {
      refreshMembers();
      toast.success('You left the workspace');
      router.push('/dashboard');
    },
    onError,
  });

  const invites = listInvitesQuery.data ?? [];
  const busy = changeRole.isPending || removeMember.isPending || leave.isPending;
  const canLeave = role === 'member' || (isOwner && ownerCount > 1);

  return (
    <SectionCard title="Workspace">
      <div className={styles.name}>{workspace?.name ?? '—'}</div>

      <ul className={styles.members}>
        {members.map((m) => {
          const isSelf = m.user.id === currentUserId;
          const isLastOwner = m.role === 'owner' && ownerCount <= 1;
          const showManage = isOwner && !isSelf && Boolean(wsId);
          return (
            <li key={m.user.id} className={styles.member}>
              <Avatar name={m.user.displayName} />
              <span className={styles.memberName}>
                {m.user.displayName}
                {isSelf ? ' (you)' : ''}
              </span>
              <Badge tone={m.role === 'owner' ? 'primary' : 'neutral'}>
                {m.role === 'owner' ? 'Owner' : 'Member'}
              </Badge>
              {showManage && !isLastOwner ? (
                <span className={styles.memberActions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      changeRole.mutate({
                        workspaceId: wsId!,
                        targetUserId: m.user.id,
                        role: m.role === 'owner' ? 'member' : 'owner',
                      })
                    }
                  >
                    {m.role === 'owner' ? 'Make member' : 'Make owner'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => removeMember.mutate({ workspaceId: wsId!, targetUserId: m.user.id })}
                  >
                    Remove
                  </Button>
                </span>
              ) : null}
            </li>
          );
        })}
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
                  <span className={styles.inviteEmail}>{invite.email ?? 'Anyone with the link'}</span>
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

      {wsId ? (
        <div className={styles.leaveRow}>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || !canLeave}
            onClick={() => leave.mutate({ workspaceId: wsId })}
          >
            Leave workspace
          </Button>
          {isOwner && ownerCount <= 1 ? (
            <span className={styles.leaveHint}>Make another member an owner before leaving.</span>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
