'use client';

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { Avatar, Badge, Button } from '@lifesync/ui';
import { SectionCard } from './SectionCard';
import styles from './WorkspaceSettings.module.css';

type Workspace = inferRouterOutputs<AppRouter>['workspace']['get'];
type Member = inferRouterOutputs<AppRouter>['workspace']['members'][number];

export interface WorkspaceSettingsProps {
  workspace: Workspace | undefined;
  members: Member[];
  currentUserId: string;
}

export function WorkspaceSettings({ workspace, members, currentUserId }: WorkspaceSettingsProps) {
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

      <div className={styles.invite}>
        <Button variant="ghost" size="sm" disabled>
          Invite a partner
        </Button>
        <span className={styles.soon}>Coming soon</span>
      </div>
    </SectionCard>
  );
}
