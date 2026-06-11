import type { ProjectType } from '../enums/project-type';
import type { Visibility } from '../enums/visibility';
import type { Priority } from '../enums/priority';
import type {
  ProjectStatus,
  TaskStatus,
  StockStatus,
  ReminderType,
  ReminderSeverity,
  InboxStatus,
} from '../enums/status';
import type { ProjectCustomFields, RecurrenceRule } from '../entities/project';
import type { GiftIdea } from '../entities/person';
import type { NotificationPreferences } from '../entities/user';

// ── Workspace ─────────────────────────────────────────────────────────────────

export interface CreateWorkspaceInput {
  name: string;
}

export interface InvitePartnerInput {
  workspaceId: string;
  email: string;
}

// ── Project ───────────────────────────────────────────────────────────────────

export interface CreateProjectInput {
  workspaceId: string;
  type: ProjectType;
  title: string;
  description?: string;
  priority?: Priority;
  ownerId?: string;
  visibility?: Visibility;
  dueDate?: string;             // ISO date string (YYYY-MM-DD)
  earliestActionDate?: string;
  leadTimeDays?: number;
  customFields?: ProjectCustomFields;
  templateId?: string;
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
}

export interface UpdateProjectInput {
  id: string;
  title?: string;
  description?: string;
  status?: ProjectStatus;
  priority?: Priority;
  ownerId?: string | null;
  visibility?: Visibility;
  dueDate?: string | null;
  earliestActionDate?: string | null;
  leadTimeDays?: number | null;
  customFields?: ProjectCustomFields;
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule | null;
}

// ── Task ──────────────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  priority?: Priority;
  ownerId?: string;
  dueDate?: string;
  parentId?: string;
  sortOrder?: number;
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
}

export interface UpdateTaskInput {
  id: string;
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  ownerId?: string | null;
  dueDate?: string | null;
  sortOrder?: number;
  parentId?: string | null;
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule | null;
  dependsOnId?: string | null;
}

export interface ReorderTaskInput {
  projectId: string;
  taskId: string;
  newOrder: number;
}

export interface MoveTaskInput {
  taskId: string;
  newProjectId: string;
}

// ── Reminder ──────────────────────────────────────────────────────────────────

export interface CreateReminderInput {
  projectId?: string;
  taskId?: string;
  userId: string;
  remindAt: string; // ISO datetime string
  type?: ReminderType;
  severity?: ReminderSeverity;
  message?: string;
}

export interface SnoozeReminderInput {
  id: string;
  snoozeUntil: string; // ISO datetime string
}

// ── Household ─────────────────────────────────────────────────────────────────

export interface CreateHouseholdItemInput {
  workspaceId: string;
  name: string;
  category?: string;
  status?: StockStatus;
  quantity?: number;
  unit?: string;
  autoReplenish?: boolean;
}

export interface UpdateHouseholdItemInput {
  id: string;
  name?: string;
  category?: string;
  status?: StockStatus;
  quantity?: number | null;
  unit?: string | null;
  autoReplenish?: boolean;
}

// ── Person ────────────────────────────────────────────────────────────────────

export interface CreatePersonInput {
  workspaceId: string;
  name: string;
  relationship?: string;
  birthday?: string;     // ISO date string
  anniversary?: string;  // ISO date string
  email?: string;
  phone?: string;
  notes?: string;
  giftIdeas?: GiftIdea[];
  customFields?: Record<string, unknown>;
}

export interface UpdatePersonInput {
  id: string;
  name?: string;
  relationship?: string | null;
  birthday?: string | null;
  anniversary?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  giftIdeas?: GiftIdea[];
  customFields?: Record<string, unknown>;
}

// ── Resource ──────────────────────────────────────────────────────────────────

export type ResourceEntityType = 'project' | 'task' | 'person';

export interface UploadResourceInput {
  entityType: ResourceEntityType;
  entityId: string;
  name: string;
  fileType: string;
  storageUrl: string;
  sizeBytes?: number;
}

// ── Template ──────────────────────────────────────────────────────────────────

export interface CreateTemplateInput {
  workspaceId: string;
  type: ProjectType;
  name: string;
  description?: string;
  defaultTasks?: Array<{ title: string; description?: string }>;
  defaultFields?: Record<string, unknown>;
}

export interface UpdateTemplateInput {
  id: string;
  name?: string;
  description?: string | null;
  defaultTasks?: Array<{ title: string; description?: string }>;
  defaultFields?: Record<string, unknown>;
}

// ── User ──────────────────────────────────────────────────────────────────────

export interface UpdateProfileInput {
  displayName?: string;
  avatarUrl?: string | null;
  timezone?: string;
}

export interface UpdateNotificationPrefsInput {
  preferences: NotificationPreferences;
}

// ── Search ────────────────────────────────────────────────────────────────────

export type SearchEntityType = 'project' | 'task' | 'person' | 'household_item';

export interface SearchInput {
  workspaceId: string;
  query: string;
  type?: SearchEntityType;
}

// ── Activity ──────────────────────────────────────────────────────────────────

export interface ActivityFeedInput {
  workspaceId: string;
  limit?: number;
  cursor?: string;
}

// ── Inbox / Quick Capture ───────────────────────────────────────────────────

export interface CaptureInboxInput {
  workspaceId: string;
  content: string;
  visibility?: Visibility;
}

export interface ListInboxInput {
  workspaceId: string;
  status?: InboxStatus;
}

export interface AssignInboxItemInput {
  id: string;
  projectId: string;
  ownerId?: string;
  dueDate?: string;
}
