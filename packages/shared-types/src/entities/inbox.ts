import type { Visibility } from '../enums/visibility';
import type { InboxStatus } from '../enums/status';

export interface InboxItem {
  id: string;
  workspaceId: string;
  content: string;
  capturedBy: string;
  ownerId: string | null;
  visibility: Visibility;
  status: InboxStatus;
  triagedToProjectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
