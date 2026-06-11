import type { MemberRole } from '../enums/status';

export interface Workspace {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: MemberRole;
  invitedAt: Date;
  joinedAt: Date | null;
}
