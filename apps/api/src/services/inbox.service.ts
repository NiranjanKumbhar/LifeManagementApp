import { and, desc, eq, ne, or } from 'drizzle-orm';
import type { z } from 'zod';
import type { Database } from '../db/client';
import { inboxItems } from '../db/schema';
import type { tasks } from '../db/schema';
import { forbidden, internal, notFound, ok, type AppError, type Result } from '../utils/errors';
import { assertWorkspaceMembership } from '../middleware/workspace';
import { logActivity } from './activity';
import { resolveUsers } from './resolve-users';
import { TaskService } from './task.service';
import type { assignInboxSchema, captureInboxSchema, listInboxSchema } from '../utils/validation';
import type { InboxItemListItem } from '@lifesync/shared-types';

type InboxRow = typeof inboxItems.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;
type CaptureInput = z.infer<typeof captureInboxSchema>;
type ListInput = z.infer<typeof listInboxSchema>;
type AssignInput = z.infer<typeof assignInboxSchema>;

const ENTITY = 'inbox_item';

function visibilityCondition(userId: string) {
  return or(ne(inboxItems.visibility, 'private'), eq(inboxItems.ownerId, userId));
}

function canRead(item: Pick<InboxRow, 'visibility' | 'ownerId'>, userId: string): boolean {
  if (item.visibility === 'private') return item.ownerId === userId;
  return true;
}

function canWrite(item: Pick<InboxRow, 'visibility' | 'ownerId'>, userId: string): boolean {
  if (item.visibility === 'shared') return true;
  return item.ownerId === userId;
}

export class InboxService {
  /** Capture a quick note. Owner + capturer default to the current user. */
  static async capture(
    db: Database,
    userId: string,
    input: CaptureInput,
  ): Promise<Result<InboxRow, AppError>> {
    try {
      const item = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(inboxItems)
          .values({
            workspaceId: input.workspaceId,
            content: input.content,
            capturedBy: userId,
            ownerId: userId,
            visibility: input.visibility ?? 'shared',
          })
          .returning();
        if (!row) throw new Error('insert returned no row');
        await logActivity(tx, {
          workspaceId: row.workspaceId,
          userId,
          entityType: ENTITY,
          entityId: row.id,
          action: 'created',
        });
        return row;
      });
      return ok(item);
    } catch (e) {
      return { success: false, error: internal('Failed to capture item', { cause: String(e) }) };
    }
  }

  /** List inbox items (pending by default), newest first, visibility-filtered. */
  static async list(
    db: Database,
    userId: string,
    input: ListInput,
  ): Promise<Result<InboxItemListItem[], AppError>> {
    const rows = await db
      .select()
      .from(inboxItems)
      .where(
        and(
          eq(inboxItems.workspaceId, input.workspaceId),
          eq(inboxItems.status, input.status ?? 'pending'),
          visibilityCondition(userId),
        ),
      )
      .orderBy(desc(inboxItems.createdAt));
    const userMap = await resolveUsers(db, rows.map((r) => r.capturedBy));
    return ok(rows.map((r) => ({ ...r, capturedByUser: userMap.get(r.capturedBy) ?? null })));
  }

  /**
   * Triage an item into a project: create a task from its content (authorizing
   * write access on the target project) and mark the item triaged.
   */
  static async assignToProject(
    db: Database,
    userId: string,
    input: AssignInput,
  ): Promise<Result<TaskRow, AppError>> {
    const item = await db.query.inboxItems.findFirst({ where: eq(inboxItems.id, input.id) });
    if (!item) return { success: false, error: notFound('Inbox item not found') };

    const member = await assertWorkspaceMembership(db, userId, item.workspaceId);
    if (!member || !canRead(item, userId)) {
      return { success: false, error: notFound('Inbox item not found') };
    }
    if (!canWrite(item, userId)) {
      return { success: false, error: forbidden('You cannot triage this item') };
    }

    const created = await TaskService.create(db, userId, {
      projectId: input.projectId,
      title: item.content,
      ...(input.ownerId ? { ownerId: input.ownerId } : {}),
      ...(input.dueDate ? { dueDate: input.dueDate } : {}),
    });
    if (!created.success) return created;

    await db
      .update(inboxItems)
      .set({ status: 'triaged', triagedToProjectId: input.projectId, updatedAt: new Date() })
      .where(eq(inboxItems.id, item.id));

    return created;
  }

  static async dismiss(db: Database, userId: string, id: string): Promise<Result<void, AppError>> {
    const item = await db.query.inboxItems.findFirst({ where: eq(inboxItems.id, id) });
    if (!item) return { success: false, error: notFound('Inbox item not found') };

    const member = await assertWorkspaceMembership(db, userId, item.workspaceId);
    if (!member || !canRead(item, userId)) {
      return { success: false, error: notFound('Inbox item not found') };
    }
    if (!canWrite(item, userId)) {
      return { success: false, error: forbidden('You cannot dismiss this item') };
    }

    await db
      .update(inboxItems)
      .set({ status: 'dismissed', updatedAt: new Date() })
      .where(eq(inboxItems.id, id));
    return ok(undefined);
  }
}
