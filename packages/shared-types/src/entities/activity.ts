import type { ActivityAction } from '../enums/status';

export type ChangeRecord = Record<string, { old: unknown; new: unknown }>;

export interface ActivityEvent {
  id: string;
  workspaceId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: ActivityAction;
  changes: ChangeRecord | null;
  createdAt: Date;
}
