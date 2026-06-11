import { asc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { Database } from '../db/client';
import { tasks, type ActivityAction } from '../db/schema';
import { forbidden, internal, notFound, ok, type AppError, type Result } from '../utils/errors';
import { loadReadableProject, loadWritableProject } from './authz';
import { logActivity } from './activity';
import type { createTaskSchema, updateTaskSchema } from '../utils/validation';

type TaskRow = typeof tasks.$inferSelect;
type CreateInput = z.infer<typeof createTaskSchema>;
type UpdateInput = z.infer<typeof updateTaskSchema>;

export interface TaskTreeNode extends TaskRow {
  children: TaskTreeNode[];
}

const ENTITY = 'task';

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
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

/** Materialized path for a child = parent's path + parent id. */
function childPath(parent: TaskRow): string {
  return parent.path ? `${parent.path}.${parent.id}` : parent.id;
}

export class TaskService {
  static async list(
    db: Database,
    userId: string,
    projectId: string,
  ): Promise<Result<TaskTreeNode[], AppError>> {
    const access = await loadReadableProject(db, userId, projectId);
    if (!access.success) return access;

    const rows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(asc(tasks.sortOrder));
    return ok(buildTaskTree(rows));
  }

  static async create(
    db: Database,
    userId: string,
    input: CreateInput,
  ): Promise<Result<TaskRow, AppError>> {
    const access = await loadWritableProject(db, userId, input.projectId);
    if (!access.success) return access;
    const project = access.data;

    let path = '';
    if (input.parentId) {
      const parent = await db.query.tasks.findFirst({ where: eq(tasks.id, input.parentId) });
      if (!parent || parent.projectId !== input.projectId) {
        return { success: false, error: notFound('Parent task not found') };
      }
      path = childPath(parent);
    }

    try {
      const task = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(tasks)
          .values({
            projectId: input.projectId,
            parentId: input.parentId ?? null,
            title: input.title,
            description: input.description ?? null,
            priority: input.priority ?? 'medium',
            ownerId: input.ownerId ?? null,
            dueDate: input.dueDate ?? null,
            sortOrder: input.sortOrder ?? 0,
            path,
            isRecurring: input.isRecurring ?? false,
            recurrenceRule: input.recurrenceRule ?? null,
          })
          .returning();
        if (!row) throw new Error('insert returned no row');
        await logActivity(tx, {
          workspaceId: project.workspaceId,
          userId,
          entityType: ENTITY,
          entityId: row.id,
          action: 'created',
        });
        return row;
      });
      return ok(task);
    } catch (e) {
      return { success: false, error: internal('Failed to create task', { cause: String(e) }) };
    }
  }

  static async update(
    db: Database,
    userId: string,
    input: UpdateInput,
  ): Promise<Result<TaskRow, AppError>> {
    const existing = await db.query.tasks.findFirst({ where: eq(tasks.id, input.id) });
    if (!existing) return { success: false, error: notFound('Task not found') };

    const access = await loadWritableProject(db, userId, existing.projectId);
    if (!access.success) return access;

    const patch: Partial<TaskRow> = {};
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    const scalarFields = [
      'title',
      'description',
      'status',
      'priority',
      'ownerId',
      'dueDate',
      'sortOrder',
      'dependsOnId',
      'isRecurring',
      'recurrenceRule',
    ] as const;

    for (const field of scalarFields) {
      if (!(field in input)) continue;
      const next = (input as Record<string, unknown>)[field];
      if (next === undefined) continue;
      const prev = (existing as Record<string, unknown>)[field];
      if (JSON.stringify(prev) === JSON.stringify(next)) continue;
      (patch as Record<string, unknown>)[field] = next;
      changes[field] = { old: prev, new: next };
    }

    // Re-parenting recomputes the materialized path of this node.
    if ('parentId' in input && input.parentId !== undefined && input.parentId !== existing.parentId) {
      let newPath = '';
      if (input.parentId) {
        if (input.parentId === existing.id) {
          return { success: false, error: forbidden('A task cannot be its own parent') };
        }
        const parent = await db.query.tasks.findFirst({ where: eq(tasks.id, input.parentId) });
        if (!parent || parent.projectId !== existing.projectId) {
          return { success: false, error: notFound('Parent task not found') };
        }
        newPath = childPath(parent);
      }
      patch.parentId = input.parentId;
      patch.path = newPath;
      changes['parentId'] = { old: existing.parentId, new: input.parentId };
    }

    const becameCompleted = input.status === 'completed' && existing.status !== 'completed';
    if (becameCompleted) {
      patch.completedAt = new Date();
      patch.completedBy = userId;
    }

    if (Object.keys(patch).length === 0) return ok(existing);
    patch.updatedAt = new Date();

    const action: ActivityAction = becameCompleted ? 'completed' : 'updated';
    return this.persist(db, existing.projectId, userId, input.id, patch, changes, action, access.data.workspaceId);
  }

  static async complete(
    db: Database,
    userId: string,
    id: string,
  ): Promise<Result<TaskRow, AppError>> {
    const existing = await db.query.tasks.findFirst({ where: eq(tasks.id, id) });
    if (!existing) return { success: false, error: notFound('Task not found') };

    const access = await loadWritableProject(db, userId, existing.projectId);
    if (!access.success) return access;

    return this.persist(
      db,
      existing.projectId,
      userId,
      id,
      { status: 'completed', completedAt: new Date(), completedBy: userId, updatedAt: new Date() },
      undefined,
      'completed',
      access.data.workspaceId,
    );
  }

  static async reorder(
    db: Database,
    userId: string,
    projectId: string,
    taskId: string,
    newOrder: number,
  ): Promise<Result<void, AppError>> {
    const access = await loadWritableProject(db, userId, projectId);
    if (!access.success) return access;

    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
    if (!task || task.projectId !== projectId) {
      return { success: false, error: notFound('Task not found') };
    }

    await db
      .update(tasks)
      .set({ sortOrder: newOrder, updatedAt: new Date() })
      .where(eq(tasks.id, taskId));
    return ok(undefined);
  }

  static async move(
    db: Database,
    userId: string,
    taskId: string,
    newProjectId: string,
  ): Promise<Result<TaskRow, AppError>> {
    const existing = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
    if (!existing) return { success: false, error: notFound('Task not found') };

    const src = await loadWritableProject(db, userId, existing.projectId);
    if (!src.success) return src;
    const dest = await loadWritableProject(db, userId, newProjectId);
    if (!dest.success) return dest;

    // Moving detaches from its parent and resets to a root in the new project.
    return this.persist(
      db,
      newProjectId,
      userId,
      taskId,
      { projectId: newProjectId, parentId: null, path: '', updatedAt: new Date() },
      { projectId: { old: existing.projectId, new: newProjectId } },
      'updated',
      dest.data.workspaceId,
    );
  }

  /** Shared update+audit path. */
  private static async persist(
    db: Database,
    _projectId: string,
    userId: string,
    taskId: string,
    patch: Partial<TaskRow>,
    changes: Record<string, { old: unknown; new: unknown }> | undefined,
    action: ActivityAction,
    workspaceId: string,
  ): Promise<Result<TaskRow, AppError>> {
    try {
      const updated = await db.transaction(async (tx) => {
        const [row] = await tx.update(tasks).set(patch).where(eq(tasks.id, taskId)).returning();
        if (!row) throw new Error('update returned no row');
        await logActivity(tx, {
          workspaceId,
          userId,
          entityType: ENTITY,
          entityId: row.id,
          action,
          changes: changes ?? null,
        });
        return row;
      });
      return ok(updated);
    } catch (e) {
      return { success: false, error: internal('Failed to update task', { cause: String(e) }) };
    }
  }
}
