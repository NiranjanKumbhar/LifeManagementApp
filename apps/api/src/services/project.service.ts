import { and, asc, desc, eq, gte, inArray, isNotNull, ne, or, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { ProjectListItem, UserRef } from '@lifesync/shared-types';
import type { Database } from '../db/client';
import { resolveUsers } from './resolve-users';
import {
  activityEvents,
  householdItems,
  people,
  projects,
  projectTemplates,
  reminders,
  tasks,
  workspaceMembers,
  type ActivityAction,
  type Priority,
  type ProjectType,
} from '../db/schema';
import { assertWorkspaceMembership } from '../middleware/workspace';
import { forbidden, internal, notFound, ok, type AppError, type Result } from '../utils/errors';
import { addDays, daysUntilAnnualDate, startOfDay, toISODateString } from '../utils/dates';
import { compareTasks } from '../utils/task-order';
import type {
  createProjectSchema,
  listProjectsSchema,
  updateProjectSchema,
} from '../utils/validation';

type CreateProjectInput = z.infer<typeof createProjectSchema>;
type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
type ListProjectsInput = z.infer<typeof listProjectsSchema>;

type ProjectRow = typeof projects.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;

export interface TaskTreeNode extends TaskRow {
  children: TaskTreeNode[];
  createdByUser?: UserRef | null;
  completedByUser?: UserRef | null;
  ownerUser?: UserRef | null;
}

export interface ProjectWithTasks extends ProjectRow {
  tasks: TaskTreeNode[];
  createdByUser?: UserRef | null;
  ownerUser?: UserRef | null;
  completedByUser?: UserRef | null;
}

export interface DashboardResult {
  todayItems: (ProjectRow | TaskRow)[];
  upcoming7Days: (ProjectRow | TaskRow)[];
  overdue: (ProjectRow | TaskRow)[];
  waitingOnPartner: (ProjectRow | TaskRow)[];
  lowStockItems: (typeof householdItems.$inferSelect)[];
  upcomingDates: (typeof people.$inferSelect)[];
  recentlyCompleted: (ProjectRow | TaskRow)[];
}

// ── Type-specific defaults ────────────────────────────────────────────────────

interface TypeDefault {
  leadTimeDays: number; // 0 means "no lead time"
  priority?: Priority;
  customFields: Record<string, unknown>;
}

const TYPE_DEFAULTS: Record<ProjectType, TypeDefault> = {
  occasion: { leadTimeDays: 30, customFields: { recurring_annually: false } },
  compliance: { leadTimeDays: 90, priority: 'high', customFields: { documents_required: [] } },
  household: { leadTimeDays: 7, customFields: {} },
  health: { leadTimeDays: 14, customFields: {} },
  travel: { leadTimeDays: 60, customFields: { visa_required: false } },
  planning: { leadTimeDays: 30, customFields: {} },
  general: { leadTimeDays: 0, customFields: {} },
};

// ── Visibility helpers ──────────────────────────────────────────────────────

/**
 * SQL condition for project visibility within an already workspace-scoped query.
 * Non-private projects are visible to all members; private only to their owner.
 */
function projectVisibilityCondition(userId: string) {
  return or(ne(projects.visibility, 'private'), eq(projects.ownerId, userId));
}

function canRead(p: Pick<ProjectRow, 'visibility' | 'ownerId'>, userId: string): boolean {
  if (p.visibility === 'private') return p.ownerId === userId;
  return true;
}

function canWrite(p: Pick<ProjectRow, 'visibility' | 'ownerId'>, userId: string): boolean {
  if (p.visibility === 'shared') return true;
  // private is editable only by its owner
  return p.ownerId === userId;
}

// ── Tree building ─────────────────────────────────────────────────────────────

function buildTaskTree(rows: TaskRow[]): TaskTreeNode[] {
  const byId = new Map<string, TaskTreeNode>();
  for (const row of rows) byId.set(row.id, { ...row, children: [] });

  const roots: TaskTreeNode[] = [];
  for (const node of byId.values()) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortRec = (nodes: TaskTreeNode[]): void => {
    nodes.sort(compareTasks);
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

// ── Service ───────────────────────────────────────────────────────────────────

export class ProjectService {
  /**
   * List projects in a workspace with optional filters, visibility-filtered.
   * Workspace membership is enforced by the calling procedure.
   */
  static async list(
    db: Database,
    userId: string,
    input: ListProjectsInput,
  ): Promise<Result<ProjectListItem[], AppError>> {
    const conditions = [
      eq(projects.workspaceId, input.workspaceId),
      projectVisibilityCondition(userId),
    ];
    if (input.type) conditions.push(eq(projects.type, input.type));
    if (input.status) conditions.push(eq(projects.status, input.status));
    if (input.ownerId) conditions.push(eq(projects.ownerId, input.ownerId));

    const rows = await db
      .select({
        project: projects,
        // taskCount excludes cancelled tasks so progress reflects actionable work
        taskCount: sql<number>`count(${tasks.id}) filter (where ${tasks.status} <> 'cancelled')`.mapWith(Number),
        completedCount: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'completed')`.mapWith(Number),
      })
      .from(projects)
      .leftJoin(tasks, eq(tasks.projectId, projects.id))
      .where(and(...conditions))
      .groupBy(projects.id)
      .orderBy(sql`${projects.dueDate} asc nulls last`, desc(projects.createdAt));

    const userMap = await resolveUsers(
      db,
      rows.flatMap((r) => [r.project.createdBy, r.project.ownerId, r.project.completedBy]),
    );
    // cast reconciles Drizzle's inferred recurrenceRule shape with shared-types RecurrenceRule
    return ok(
      rows.map(
        (r) =>
          ({
            ...r.project,
            taskCount: r.taskCount,
            completedCount: r.completedCount,
            createdByUser: userMap.get(r.project.createdBy ?? '') ?? null,
            ownerUser: userMap.get(r.project.ownerId ?? '') ?? null,
            completedByUser: userMap.get(r.project.completedBy ?? '') ?? null,
          }) as ProjectListItem,
      ),
    );
  }

  /** Get a single project with its nested task tree. */
  static async get(
    db: Database,
    userId: string,
    id: string,
  ): Promise<Result<ProjectWithTasks, AppError>> {
    // Fetch the project and its tasks concurrently — the tasks query only needs
    // the project id (which we already have), so it need not wait on the project
    // row. Task rows are discarded below if the caller can't read the project.
    const [project, taskRows] = await Promise.all([
      db.query.projects.findFirst({ where: eq(projects.id, id) }),
      db
        .select()
        .from(tasks)
        .where(eq(tasks.projectId, id))
        .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt), asc(tasks.id)),
    ]);
    if (!project) return { success: false, error: notFound('Project not found') };

    const isMember = await assertWorkspaceMembership(db, userId, project.workspaceId);
    // Hide existence from non-members and from non-owners of private projects.
    if (!isMember || !canRead(project, userId)) {
      return { success: false, error: notFound('Project not found') };
    }

    const allIds = [
      project.createdBy,
      project.ownerId,
      project.completedBy,
      ...taskRows.flatMap((r) => [r.createdBy, r.completedBy, r.ownerId]),
    ];
    const userMap = await resolveUsers(db, allIds);
    const attach = (nodes: TaskTreeNode[]): void => {
      for (const n of nodes) {
        n.createdByUser = userMap.get(n.createdBy ?? '') ?? null;
        n.completedByUser = userMap.get(n.completedBy ?? '') ?? null;
        n.ownerUser = userMap.get(n.ownerId ?? '') ?? null;
        attach(n.children);
      }
    };
    const tree = buildTaskTree(taskRows);
    attach(tree);
    return ok({
      ...project,
      tasks: tree,
      createdByUser: userMap.get(project.createdBy ?? '') ?? null,
      ownerUser: userMap.get(project.ownerId ?? '') ?? null,
      completedByUser: userMap.get(project.completedBy ?? '') ?? null,
    });
  }

  /**
   * Create a project. Applies type-specific defaults, instantiates template
   * tasks, derives an earliest-action date, schedules a lead-time reminder,
   * and logs an activity event — all atomically.
   */
  static async create(
    db: Database,
    userId: string,
    input: CreateProjectInput,
  ): Promise<Result<ProjectRow, AppError>> {
    const defaults = TYPE_DEFAULTS[input.type];

    // Resolve an optional template (system, or owned by this workspace).
    let templateFields: Record<string, unknown> = {};
    let templateTasks: Array<{ title: string; description?: string }> = [];
    if (input.templateId) {
      const template = await db.query.projectTemplates.findFirst({
        where: eq(projectTemplates.id, input.templateId),
      });
      if (!template) {
        return { success: false, error: notFound('Template not found') };
      }
      if (!template.isSystem && template.workspaceId !== input.workspaceId) {
        return { success: false, error: forbidden('Template belongs to another workspace') };
      }
      templateFields = template.defaultFields ?? {};
      templateTasks = template.defaultTasks ?? [];
    }

    const leadTimeDays =
      input.leadTimeDays ?? (defaults.leadTimeDays > 0 ? defaults.leadTimeDays : null);

    const dueDate = input.dueDate ?? null;
    const earliestActionDate =
      input.earliestActionDate ??
      (dueDate && leadTimeDays ? toISODateString(addDays(dueDate, -leadTimeDays)) : null);

    const customFields = {
      ...defaults.customFields,
      ...templateFields,
      ...(input.customFields ?? {}),
    };

    const priority = input.priority ?? defaults.priority ?? 'medium';
    const reminderUserId = input.ownerId ?? userId;

    try {
      const project = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(projects)
          .values({
            workspaceId: input.workspaceId,
            type: input.type,
            title: input.title,
            description: input.description ?? null,
            priority,
            ownerId: input.ownerId ?? userId,
            createdBy: userId,
            visibility: input.visibility ?? 'shared',
            dueDate,
            earliestActionDate,
            leadTimeDays,
            customFields,
            templateId: input.templateId ?? null,
            isRecurring: input.isRecurring ?? false,
            recurrenceRule: input.recurrenceRule ?? null,
          })
          .returning();

        if (!created) throw new Error('Project insert returned no row');

        // Instantiate template tasks as top-level tasks.
        if (templateTasks.length > 0) {
          await tx.insert(tasks).values(
            templateTasks.map((t, index) => ({
              projectId: created.id,
              title: t.title,
              description: t.description ?? null,
              sortOrder: index,
              path: '',
              ownerId: created.ownerId,
            })),
          );
        }

        // Schedule an initial lead-time reminder when there's a deadline.
        if (dueDate && earliestActionDate) {
          await tx.insert(reminders).values({
            projectId: created.id,
            userId: reminderUserId,
            remindAt: startOfDay(earliestActionDate),
            type: 'lead_time',
            severity: leadTimeDays && leadTimeDays <= 7 ? 'warning' : 'info',
            message: `Time to start: "${created.title}"`,
          });
        }

        await logActivity(tx, created.workspaceId, userId, created.id, 'created');
        return created;
      });

      return ok(project);
    } catch (e) {
      return { success: false, error: internal('Failed to create project', { cause: String(e) }) };
    }
  }

  /** Update mutable fields on a project, recording field-level changes. */
  static async update(
    db: Database,
    userId: string,
    input: UpdateProjectInput,
  ): Promise<Result<ProjectRow, AppError>> {
    const existing = await db.query.projects.findFirst({ where: eq(projects.id, input.id) });
    if (!existing) return { success: false, error: notFound('Project not found') };

    const isMember = await assertWorkspaceMembership(db, userId, existing.workspaceId);
    if (!isMember || !canRead(existing, userId)) {
      return { success: false, error: notFound('Project not found') };
    }
    if (!canWrite(existing, userId)) {
      return { success: false, error: forbidden('You cannot edit this project') };
    }

    const patch: Partial<ProjectRow> = {};
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    const fields = [
      'title',
      'description',
      'status',
      'priority',
      'ownerId',
      'visibility',
      'dueDate',
      'earliestActionDate',
      'leadTimeDays',
      'customFields',
      'isRecurring',
      'recurrenceRule',
    ] as const;

    for (const field of fields) {
      if (!(field in input)) continue;
      const next = (input as Record<string, unknown>)[field];
      if (next === undefined) continue;
      const prev = (existing as Record<string, unknown>)[field];
      if (JSON.stringify(prev) === JSON.stringify(next)) continue;
      (patch as Record<string, unknown>)[field] = next;
      changes[field] = { old: prev, new: next };
    }

    if (Object.keys(patch).length === 0) {
      return ok(existing); // nothing to do
    }

    patch.updatedAt = new Date();

    try {
      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(projects)
          .set(patch)
          .where(eq(projects.id, input.id))
          .returning();
        if (!row) throw new Error('Project update returned no row');
        await logActivity(tx, row.workspaceId, userId, row.id, 'updated', changes);
        return row;
      });
      return ok(updated);
    } catch (e) {
      return { success: false, error: internal('Failed to update project', { cause: String(e) }) };
    }
  }

  static async complete(
    db: Database,
    userId: string,
    id: string,
  ): Promise<Result<ProjectRow, AppError>> {
    return this.transition(db, userId, id, 'completed');
  }

  static async archive(
    db: Database,
    userId: string,
    id: string,
  ): Promise<Result<ProjectRow, AppError>> {
    return this.transition(db, userId, id, 'archived');
  }

  /** Shared status-transition path for complete/archive. */
  private static async transition(
    db: Database,
    userId: string,
    id: string,
    status: 'completed' | 'archived',
  ): Promise<Result<ProjectRow, AppError>> {
    const existing = await db.query.projects.findFirst({ where: eq(projects.id, id) });
    if (!existing) return { success: false, error: notFound('Project not found') };

    const isMember = await assertWorkspaceMembership(db, userId, existing.workspaceId);
    if (!isMember || !canRead(existing, userId)) {
      return { success: false, error: notFound('Project not found') };
    }
    if (!canWrite(existing, userId)) {
      return { success: false, error: forbidden('You cannot change this project') };
    }

    const action: ActivityAction = status === 'completed' ? 'completed' : 'archived';

    try {
      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(projects)
          .set({
            status,
            completedAt: status === 'completed' ? new Date() : existing.completedAt,
            completedBy: status === 'completed' ? userId : existing.completedBy,
            updatedAt: new Date(),
          })
          .where(eq(projects.id, id))
          .returning();
        if (!row) throw new Error('Project transition returned no row');
        await logActivity(tx, row.workspaceId, userId, row.id, action);
        return row;
      });
      return ok(updated);
    } catch (e) {
      return { success: false, error: internal(`Failed to ${status} project`, { cause: String(e) }) };
    }
  }

  /**
   * Aggregate the dashboard for a workspace member: deadlines bucketed by
   * urgency, partner accountability, low stock, upcoming dates, and recent wins.
   */
  static async dashboard(
    db: Database,
    userId: string,
    workspaceId: string,
  ): Promise<Result<DashboardResult, AppError>> {
    const now = new Date();
    const today = toISODateString(now);
    const in7 = toISODateString(addDays(now, 7));
    const ago7 = startOfDay(addDays(now, -7));

    const partner = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        ne(workspaceMembers.userId, userId),
      ),
    });
    const partnerId = partner?.userId ?? null;

    const activeStatuses = ['active', 'on_hold'] as const;
    const openTaskStatuses = ['pending', 'in_progress', 'blocked'] as const;

    const visibleProjectCond = and(
      eq(projects.workspaceId, workspaceId),
      projectVisibilityCondition(userId),
    );

    const [
      datedProjects,
      datedTasks,
      lowStockItems,
      peopleRows,
      recentProjects,
      recentTasks,
    ] = await Promise.all([
      // Active projects with a due date
      db
        .select()
        .from(projects)
        .where(
          and(visibleProjectCond, inArray(projects.status, [...activeStatuses]), isNotNull(projects.dueDate)),
        ),

      // Open tasks (visible via their project) with a due date
      db
        .select({ task: tasks })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(projects.workspaceId, workspaceId),
            projectVisibilityCondition(userId),
            inArray(tasks.status, [...openTaskStatuses]),
            isNotNull(tasks.dueDate),
          ),
        )
        .then((rows) => rows.map((r) => r.task)),

      // Low / out household items
      db
        .select()
        .from(householdItems)
        .where(
          and(
            eq(householdItems.workspaceId, workspaceId),
            inArray(householdItems.status, ['low', 'out']),
          ),
        )
        .orderBy(asc(householdItems.category), asc(householdItems.sortOrder)),

      // People with any anniversary/birthday recorded (filtered in JS for window)
      db
        .select()
        .from(people)
        .where(
          and(
            eq(people.workspaceId, workspaceId),
            or(isNotNull(people.birthday), isNotNull(people.anniversary)),
          ),
        ),

      // Projects completed in the last 7 days
      db
        .select()
        .from(projects)
        .where(
          and(
            visibleProjectCond,
            eq(projects.status, 'completed'),
            gte(projects.completedAt, ago7),
          ),
        ),

      // Tasks completed in the last 7 days
      db
        .select({ task: tasks })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(projects.workspaceId, workspaceId),
            projectVisibilityCondition(userId),
            eq(tasks.status, 'completed'),
            gte(tasks.completedAt, ago7),
          ),
        )
        .then((rows) => rows.map((r) => r.task)),
    ]);

    const dated: (ProjectRow | TaskRow)[] = [...datedProjects, ...datedTasks];

    const overdue = dated.filter((i) => i.dueDate !== null && i.dueDate < today);
    const todayItems = dated.filter((i) => i.dueDate === today);
    const upcoming7Days = dated.filter(
      (i) => i.dueDate !== null && i.dueDate > today && i.dueDate <= in7,
    );

    const waitingOnPartner: (ProjectRow | TaskRow)[] = partnerId
      ? [
          ...datedProjects.filter((p) => p.ownerId === partnerId && p.visibility !== 'private'),
          ...datedTasks.filter((t) => t.ownerId === partnerId),
        ]
      : [];

    const upcomingDates = peopleRows.filter((person) => {
      const candidates = [person.birthday, person.anniversary].filter(
        (d): d is string => d !== null,
      );
      return candidates.some((d) => {
        const days = daysUntilAnnualDate(d);
        return days >= 0 && days <= 30;
      });
    });

    return ok({
      todayItems,
      upcoming7Days,
      overdue,
      waitingOnPartner,
      lowStockItems,
      upcomingDates,
      recentlyCompleted: [...recentProjects, ...recentTasks],
    });
  }
}

// ── Activity logging ──────────────────────────────────────────────────────────

async function logActivity(
  tx: Parameters<Parameters<Database['transaction']>[0]>[0],
  workspaceId: string,
  userId: string,
  entityId: string,
  action: ActivityAction,
  changes?: Record<string, { old: unknown; new: unknown }>,
): Promise<void> {
  await tx.insert(activityEvents).values({
    workspaceId,
    userId,
    entityType: 'project',
    entityId,
    action,
    changes: changes ?? null,
  });
}
