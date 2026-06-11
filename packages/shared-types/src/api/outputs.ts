import type { Project } from '../entities/project';
import type { Task, TaskNode } from '../entities/task';
import type { Person } from '../entities/person';
import type { HouseholdItem } from '../entities/household';
import type { WorkspaceMember } from '../entities/workspace';
import type { User } from '../entities/user';
import type { ActivityEvent } from '../entities/activity';
import type { UrgencyLevel } from '../enums/urgency';
import type { InviteStatus } from '../enums/status';
import type { SearchEntityType } from './inputs';

// ── Workspace ─────────────────────────────────────────────────────────────────

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  invitedBy: string; // userId
  status: InviteStatus;
  expiresAt: Date;
  createdAt: Date;
}

export interface MemberWithUser extends WorkspaceMember {
  user: Pick<User, 'id' | 'displayName' | 'email' | 'avatarUrl'>;
}

// ── Project ───────────────────────────────────────────────────────────────────

export interface ProjectWithTasks extends Project {
  tasks: TaskNode[];
}

export interface ProjectWithUrgency {
  project: Project;
  urgency: UrgencyLevel;
  daysUntilDue: number | null;
  riskScore: number; // 0–100
}

// ── Person ────────────────────────────────────────────────────────────────────

export interface PersonWithProjects extends Person {
  projects: Project[];
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  type: SearchEntityType;
  item: Project | Task | Person | HouseholdItem;
  highlights: string[];
}

// ── Activity ──────────────────────────────────────────────────────────────────

export interface ActivityFeedPage {
  items: ActivityEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ── Generic ───────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ── Errors ────────────────────────────────────────────────────────────────────

export type ApiErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'VALIDATION' | 'CONFLICT' | 'INTERNAL';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
