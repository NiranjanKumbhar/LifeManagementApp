import type { MemberRole, InviteStatus } from '../enums/status';

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

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  token: string;
  email: string | null;
  role: MemberRole;
  status: InviteStatus;
  invitedBy: string; // userId
  expiresAt: Date;
  acceptedBy: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
}
