import { z } from 'zod';

/**
 * Shared Zod schemas. Mirror the input types in `@lifesync/shared-types`.
 * Routers validate with these; the inferred shapes are structurally
 * assignable to the shared-types interfaces consumed by the services.
 */

// ── Primitives ──────────────────────────────────────────────────────────────
export const uuidSchema = z.string().uuid();

/** A calendar date string, YYYY-MM-DD (matches Postgres `date` columns). */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format');

// ── Enums ───────────────────────────────────────────────────────────────────
export const projectTypeSchema = z.enum([
  'occasion',
  'compliance',
  'household',
  'health',
  'travel',
  'planning',
  'general',
]);

export const projectStatusSchema = z.enum(['active', 'completed', 'archived', 'on_hold']);
export const taskStatusSchema = z.enum([
  'pending',
  'in_progress',
  'completed',
  'cancelled',
  'blocked',
]);
export const prioritySchema = z.enum(['urgent', 'high', 'medium', 'low', 'none']);
export const visibilitySchema = z.enum(['shared', 'mine_visible', 'private']);

export const recurrenceRuleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  interval: z.number().int().positive().optional(),
  day: z.string().optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  month: z.number().int().min(1).max(12).optional(),
  endDate: z.string().optional(),
  count: z.number().int().positive().optional(),
});

export const customFieldsSchema = z.record(z.string(), z.unknown());

// ── Project ─────────────────────────────────────────────────────────────────
export const createProjectSchema = z.object({
  workspaceId: uuidSchema,
  type: projectTypeSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: prioritySchema.optional(),
  ownerId: uuidSchema.optional(),
  visibility: visibilitySchema.optional(),
  dueDate: dateStringSchema.optional(),
  earliestActionDate: dateStringSchema.optional(),
  leadTimeDays: z.number().int().min(0).max(3650).optional(),
  customFields: customFieldsSchema.optional(),
  templateId: uuidSchema.optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: recurrenceRuleSchema.optional(),
});

export const updateProjectSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: projectStatusSchema.optional(),
  priority: prioritySchema.optional(),
  ownerId: uuidSchema.nullable().optional(),
  visibility: visibilitySchema.optional(),
  dueDate: dateStringSchema.nullable().optional(),
  earliestActionDate: dateStringSchema.nullable().optional(),
  leadTimeDays: z.number().int().min(0).max(3650).nullable().optional(),
  customFields: customFieldsSchema.optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: recurrenceRuleSchema.nullable().optional(),
});

export const listProjectsSchema = z.object({
  workspaceId: uuidSchema,
  type: projectTypeSchema.optional(),
  status: projectStatusSchema.optional(),
  ownerId: uuidSchema.optional(),
});

export const projectIdSchema = z.object({ id: uuidSchema });
export const workspaceIdSchema = z.object({ workspaceId: uuidSchema });

// ── Workspace ───────────────────────────────────────────────────────────────
export const workspaceGetSchema = z.object({ id: uuidSchema });
export const createWorkspaceSchema = z.object({ name: z.string().min(1).max(200) });
export const membersSchema = z.object({ workspaceId: uuidSchema });
export const createInviteSchema = z.object({
  workspaceId: uuidSchema,
  email: z.string().email().optional(),
});
export const acceptInviteSchema = z.object({ token: z.string().min(1) });
export const invitePreviewSchema = z.object({ token: z.string().min(1) });
export const inviteIdSchema = z.object({ id: uuidSchema });
export const listInvitesSchema = z.object({ workspaceId: uuidSchema });

// ── Task ────────────────────────────────────────────────────────────────────
export const listTasksSchema = z.object({ projectId: uuidSchema });
export const taskIdSchema = z.object({ id: uuidSchema });

export const createTaskSchema = z.object({
  projectId: uuidSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  priority: prioritySchema.optional(),
  ownerId: uuidSchema.optional(),
  dueDate: dateStringSchema.optional(),
  parentId: uuidSchema.optional(),
  sortOrder: z.number().int().min(0).optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: recurrenceRuleSchema.optional(),
});

export const updateTaskSchema = z.object({
  id: uuidSchema,
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: prioritySchema.optional(),
  ownerId: uuidSchema.nullable().optional(),
  dueDate: dateStringSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  parentId: uuidSchema.nullable().optional(),
  dependsOnId: uuidSchema.nullable().optional(),
  isRecurring: z.boolean().optional(),
  recurrenceRule: recurrenceRuleSchema.nullable().optional(),
});

export const reorderTaskSchema = z.object({
  projectId: uuidSchema,
  taskId: uuidSchema,
  newOrder: z.number().int().min(0),
});
export const moveTaskSchema = z.object({ taskId: uuidSchema, newProjectId: uuidSchema });

// ── Reminder ────────────────────────────────────────────────────────────────
export const listRemindersSchema = z.object({ includeSent: z.boolean().optional() });
export const reminderIdSchema = z.object({ id: uuidSchema });

export const createReminderSchema = z.object({
  projectId: uuidSchema.optional(),
  taskId: uuidSchema.optional(),
  remindAt: z.string().datetime(),
  type: z.enum(['standard', 'lead_time', 'escalation', 'recurring']).optional(),
  severity: z.enum(['info', 'warning', 'urgent', 'critical']).optional(),
  message: z.string().max(1000).optional(),
});

export const snoozeReminderSchema = z.object({
  id: uuidSchema,
  snoozeUntil: z.string().datetime(),
});

// ── Household ───────────────────────────────────────────────────────────────
export const stockStatusSchema = z.enum(['stocked', 'low', 'out', 'on_list']);

export const listHouseholdSchema = z.object({
  workspaceId: uuidSchema,
  status: stockStatusSchema.optional(),
  category: z.string().max(100).optional(),
});
export const householdIdSchema = z.object({ id: uuidSchema });

export const createHouseholdSchema = z.object({
  workspaceId: uuidSchema,
  name: z.string().min(1).max(200),
  category: z.string().max(100).optional(),
  status: stockStatusSchema.optional(),
  quantity: z.number().int().min(0).optional(),
  unit: z.string().max(50).optional(),
  autoReplenish: z.boolean().optional(),
});

export const updateHouseholdSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200).optional(),
  category: z.string().max(100).optional(),
  status: stockStatusSchema.optional(),
  quantity: z.number().int().min(0).nullable().optional(),
  unit: z.string().max(50).nullable().optional(),
  autoReplenish: z.boolean().optional(),
});

// ── Person ──────────────────────────────────────────────────────────────────
export const giftIdeaSchema = z.object({
  idea: z.string().min(1),
  budget: z.number().optional(),
  purchased: z.boolean().optional(),
  url: z.string().optional(),
});

export const listPeopleSchema = z.object({ workspaceId: uuidSchema });
export const personIdSchema = z.object({ id: uuidSchema });

export const createPersonSchema = z.object({
  workspaceId: uuidSchema,
  name: z.string().min(1).max(200),
  relationship: z.string().max(100).optional(),
  birthday: dateStringSchema.optional(),
  anniversary: dateStringSchema.optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  giftIdeas: z.array(giftIdeaSchema).optional(),
  customFields: customFieldsSchema.optional(),
});

export const updatePersonSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200).optional(),
  relationship: z.string().max(100).nullable().optional(),
  birthday: dateStringSchema.nullable().optional(),
  anniversary: dateStringSchema.nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  giftIdeas: z.array(giftIdeaSchema).optional(),
  customFields: customFieldsSchema.optional(),
});

// ── Notification ────────────────────────────────────────────────────────────
export const listNotificationsSchema = z.object({ unreadOnly: z.boolean().optional() });
export const notificationIdSchema = z.object({ id: uuidSchema });

// ── Resource ────────────────────────────────────────────────────────────────
export const listResourcesSchema = z
  .object({
    projectId: uuidSchema.optional(),
    taskId: uuidSchema.optional(),
    personId: uuidSchema.optional(),
  })
  .refine((d) => Boolean(d.projectId) || Boolean(d.taskId) || Boolean(d.personId), {
    message: 'One of projectId, taskId, or personId is required',
  });

export const resourceIdSchema = z.object({ id: uuidSchema });

export const uploadResourceSchema = z.object({
  entityType: z.enum(['project', 'task', 'person']),
  entityId: uuidSchema,
  name: z.string().min(1).max(300),
  fileType: z.string().min(1).max(100),
  storageUrl: z.string().min(1).max(2000),
  sizeBytes: z.number().int().nonnegative().optional(),
});

// ── Template ────────────────────────────────────────────────────────────────
const templateTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
});

export const listTemplatesSchema = z.object({
  workspaceId: uuidSchema,
  type: projectTypeSchema.optional(),
});
export const templateIdSchema = z.object({ id: uuidSchema });

export const createTemplateSchema = z.object({
  workspaceId: uuidSchema,
  type: projectTypeSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  defaultTasks: z.array(templateTaskSchema).optional(),
  defaultFields: customFieldsSchema.optional(),
});

export const updateTemplateSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  defaultTasks: z.array(templateTaskSchema).optional(),
  defaultFields: customFieldsSchema.optional(),
});

// ── Search ──────────────────────────────────────────────────────────────────
export const searchSchema = z.object({
  workspaceId: uuidSchema,
  query: z.string().min(1).max(200),
  type: z.enum(['project', 'task', 'person', 'household_item']).optional(),
});

// ── Activity ────────────────────────────────────────────────────────────────
export const activityFeedSchema = z.object({
  workspaceId: uuidSchema,
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

// ── User ────────────────────────────────────────────────────────────────────
export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  avatarUrl: z.string().max(2000).nullable().optional(),
  timezone: z.string().max(100).optional(),
});

export const notificationPreferencesSchema = z.object({
  quietHours: z.object({ start: z.string(), end: z.string() }).optional(),
  digestMode: z.enum(['none', 'daily', 'weekly']).optional(),
  channels: z.object({ push: z.boolean(), email: z.boolean(), inApp: z.boolean() }).optional(),
});

export const updateNotificationPrefsSchema = z.object({
  preferences: notificationPreferencesSchema,
});

// ── Calendar ─────────────────────────────────────────────────────────────────
export const calendarRangeSchema = z.object({
  workspaceId: uuidSchema,
  from: dateStringSchema,
  to: dateStringSchema,
});

// ── Inbox / Quick Capture ────────────────────────────────────────────────────
export const captureInboxSchema = z.object({
  workspaceId: uuidSchema,
  content: z.string().min(1).max(2000),
  visibility: visibilitySchema.optional(),
});

export const listInboxSchema = z.object({
  workspaceId: uuidSchema,
  status: z.enum(['pending', 'triaged', 'dismissed']).optional(),
});

export const inboxIdSchema = z.object({ id: uuidSchema });

export const assignInboxSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  ownerId: uuidSchema.optional(),
  dueDate: dateStringSchema.optional(),
});
