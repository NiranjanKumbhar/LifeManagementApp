// ── Enums ─────────────────────────────────────────────────────────────────────
export type { ProjectType } from './enums/project-type';
export type { Visibility } from './enums/visibility';
export type { UrgencyLevel } from './enums/urgency';
export type { Priority } from './enums/priority';
export type {
  ProjectStatus,
  TaskStatus,
  StockStatus,
  ReminderType,
  ReminderSeverity,
  NotificationType,
  ActivityAction,
  MemberRole,
  DigestMode,
  InviteStatus,
  InboxStatus,
} from './enums/status';

// ── Entities ──────────────────────────────────────────────────────────────────
export type { Workspace, WorkspaceMember } from './entities/workspace';
export type {
  User,
  NotificationPreferences,
  NotificationChannels,
  QuietHours,
} from './entities/user';
export type {
  Project,
  ProjectTemplate,
  RecurrenceRule,
  RecurrenceFrequency,
  ProjectCustomFields,
  OccasionFields,
  ComplianceFields,
  HouseholdProjectFields,
  HealthFields,
  TravelFields,
  PlanningFields,
} from './entities/project';
export type { Task, TaskNode } from './entities/task';
export type { Reminder } from './entities/reminder';
export type { HouseholdItem } from './entities/household';
export type { Person, GiftIdea } from './entities/person';
export type { Resource } from './entities/resource';
export type { ActivityEvent, ChangeRecord } from './entities/activity';
export type { Notification } from './entities/notification';
export type { InboxItem } from './entities/inbox';

// ── API — Inputs ──────────────────────────────────────────────────────────────
export type {
  CreateWorkspaceInput,
  InvitePartnerInput,
  CreateProjectInput,
  UpdateProjectInput,
  CreateTaskInput,
  UpdateTaskInput,
  ReorderTaskInput,
  MoveTaskInput,
  CreateReminderInput,
  SnoozeReminderInput,
  CreateHouseholdItemInput,
  UpdateHouseholdItemInput,
  CreatePersonInput,
  UpdatePersonInput,
  ResourceEntityType,
  UploadResourceInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  UpdateProfileInput,
  UpdateNotificationPrefsInput,
  SearchEntityType,
  SearchInput,
  ActivityFeedInput,
  CaptureInboxInput,
  ListInboxInput,
  AssignInboxItemInput,
} from './api/inputs';

// ── API — Outputs ─────────────────────────────────────────────────────────────
export type {
  WorkspaceInvite,
  MemberWithUser,
  ProjectListItem,
  ProjectWithTasks,
  ProjectWithUrgency,
  PersonWithProjects,
  SearchResult,
  ActivityFeedPage,
  PaginatedResponse,
  ApiError,
  ApiErrorCode,
} from './api/outputs';

// ── API — Dashboard ───────────────────────────────────────────────────────────
export type { DashboardData } from './api/dashboard';

// ── API — Calendar ────────────────────────────────────────────────────────────
export type { CalendarItem, CalendarItemKind } from './api/calendar';
