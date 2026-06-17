import { and, asc, count, eq, ne } from 'drizzle-orm';
import type { Database } from '../db/client';
import { users, workspaceMembers, workspaces } from '../db/schema';
import { internal, ok, type AppError, type Result } from '../utils/errors';
import type { Tx } from './activity';

export class AccountService {
  /**
   * Remove the user from every workspace: delete the ones where they are the sole
   * member; leave the shared ones (promoting the earliest-joined remaining member to
   * owner if the leaver was the only owner). Does NOT delete the user row.
   */
  private static async detachFromWorkspaces(db: Tx, userId: string): Promise<void> {
    const memberships = await db
      .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId));

    for (const m of memberships) {
      const [totalRow] = await db
        .select({ value: count() })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, m.workspaceId));
      if ((totalRow?.value ?? 0) <= 1) {
        await db.delete(workspaces).where(eq(workspaces.id, m.workspaceId)); // cascade
        continue;
      }
      if (m.role === 'owner') {
        const [ownersRow] = await db
          .select({ value: count() })
          .from(workspaceMembers)
          .where(
            and(eq(workspaceMembers.workspaceId, m.workspaceId), eq(workspaceMembers.role, 'owner')),
          );
        if ((ownersRow?.value ?? 0) <= 1) {
          const next = await db.query.workspaceMembers.findFirst({
            where: and(
              eq(workspaceMembers.workspaceId, m.workspaceId),
              ne(workspaceMembers.userId, userId),
            ),
            orderBy: asc(workspaceMembers.joinedAt),
          });
          if (next) {
            await db
              .update(workspaceMembers)
              .set({ role: 'owner' })
              .where(
                and(
                  eq(workspaceMembers.workspaceId, m.workspaceId),
                  eq(workspaceMembers.userId, next.userId),
                ),
              );
          }
        }
      }
      await db
        .delete(workspaceMembers)
        .where(
          and(eq(workspaceMembers.workspaceId, m.workspaceId), eq(workspaceMembers.userId, userId)),
        );
    }
  }

  /** Delete the user's solo workspaces and leave shared ones; keep the user row. */
  static async clearData(db: Database, userId: string): Promise<Result<void, AppError>> {
    try {
      await db.transaction(async (tx) => {
        await this.detachFromWorkspaces(tx, userId);
      });
      return ok(undefined);
    } catch (e) {
      return { success: false, error: internal('Failed to clear data', { cause: String(e) }) };
    }
  }

  /** Full account removal: detach from workspaces, then delete the user row. */
  static async deleteAccount(db: Database, userId: string): Promise<Result<void, AppError>> {
    try {
      await db.transaction(async (tx) => {
        await this.detachFromWorkspaces(tx, userId);
        // FK ON DELETE rules null attribution and cascade the user's personal rows.
        await tx.delete(users).where(eq(users.id, userId));
      });
      return ok(undefined);
    } catch (e) {
      return { success: false, error: internal('Failed to delete account', { cause: String(e) }) };
    }
  }
}
