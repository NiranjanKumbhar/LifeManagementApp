import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { notifications } from '../db/schema';
import { forbidden, notFound, ok, type AppError, type Result } from '../utils/errors';

type NotificationRow = typeof notifications.$inferSelect;

export class NotificationService {
  /** List the current user's notifications, newest first. */
  static async list(
    db: Database,
    userId: string,
    unreadOnly: boolean,
  ): Promise<Result<NotificationRow[], AppError>> {
    const conditions = [eq(notifications.userId, userId)];
    if (unreadOnly) conditions.push(eq(notifications.isRead, false));

    const rows = await db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt));
    return ok(rows);
  }

  static async markRead(
    db: Database,
    userId: string,
    id: string,
  ): Promise<Result<void, AppError>> {
    const existing = await db.query.notifications.findFirst({ where: eq(notifications.id, id) });
    if (!existing) return { success: false, error: notFound('Notification not found') };
    if (existing.userId !== userId) {
      return { success: false, error: forbidden('Not your notification') };
    }

    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, id));
    return ok(undefined);
  }

  static async markAllRead(db: Database, userId: string): Promise<Result<void, AppError>> {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return ok(undefined);
  }
}
