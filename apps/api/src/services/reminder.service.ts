import { and, asc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { Database } from '../db/client';
import { reminders, tasks } from '../db/schema';
import { forbidden, notFound, ok, type AppError, type Result } from '../utils/errors';
import { loadReadableProject } from './authz';
import type { createReminderSchema } from '../utils/validation';

type ReminderRow = typeof reminders.$inferSelect;
type CreateReminderInput = z.infer<typeof createReminderSchema>;

export class ReminderService {
  /** List the current user's reminders (pending by default), soonest first. */
  static async list(
    db: Database,
    userId: string,
    includeSent: boolean,
  ): Promise<Result<ReminderRow[], AppError>> {
    const conditions = [eq(reminders.userId, userId)];
    if (!includeSent) conditions.push(eq(reminders.isSent, false));

    const rows = await db
      .select()
      .from(reminders)
      .where(and(...conditions))
      .orderBy(asc(reminders.remindAt));
    return ok(rows);
  }

  /** Create a reminder for the current user against a project or task they can see. */
  static async create(
    db: Database,
    userId: string,
    input: CreateReminderInput,
  ): Promise<Result<ReminderRow, AppError>> {
    // Resolve and authorize the target entity's project.
    let projectId = input.projectId ?? null;
    if (input.taskId) {
      const task = await db.query.tasks.findFirst({ where: eq(tasks.id, input.taskId) });
      if (!task) return { success: false, error: notFound('Task not found') };
      projectId = task.projectId;
    }
    if (projectId) {
      const access = await loadReadableProject(db, userId, projectId);
      if (!access.success) return access;
    }

    const [row] = await db
      .insert(reminders)
      .values({
        projectId: input.projectId ?? null,
        taskId: input.taskId ?? null,
        userId,
        remindAt: new Date(input.remindAt),
        type: input.type ?? 'standard',
        severity: input.severity ?? 'info',
        message: input.message ?? null,
      })
      .returning();
    if (!row) return { success: false, error: notFound('Reminder creation failed') };
    return ok(row);
  }

  static async snooze(
    db: Database,
    userId: string,
    id: string,
    snoozeUntil: string,
  ): Promise<Result<ReminderRow, AppError>> {
    const existing = await db.query.reminders.findFirst({ where: eq(reminders.id, id) });
    if (!existing) return { success: false, error: notFound('Reminder not found') };
    if (existing.userId !== userId) return { success: false, error: forbidden('Not your reminder') };

    const [row] = await db
      .update(reminders)
      .set({ snoozedUntil: new Date(snoozeUntil), isSent: false })
      .where(eq(reminders.id, id))
      .returning();
    if (!row) return { success: false, error: notFound('Reminder not found') };
    return ok(row);
  }

  static async dismiss(db: Database, userId: string, id: string): Promise<Result<void, AppError>> {
    const existing = await db.query.reminders.findFirst({ where: eq(reminders.id, id) });
    if (!existing) return { success: false, error: notFound('Reminder not found') };
    if (existing.userId !== userId) return { success: false, error: forbidden('Not your reminder') };

    await db.delete(reminders).where(eq(reminders.id, id));
    return ok(undefined);
  }
}
