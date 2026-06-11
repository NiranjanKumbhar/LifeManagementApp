import { eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { users, workspaceMembers, workspaces } from '../db/schema';
import { internal, notFound, ok, type AppError, type Result } from '../utils/errors';
import { assertWorkspaceMembership } from '../middleware/workspace';

type WorkspaceRow = typeof workspaces.$inferSelect;
type MemberRow = typeof workspaceMembers.$inferSelect;

export interface MemberWithUser extends MemberRow {
  user: { id: string; displayName: string; email: string; avatarUrl: string | null };
}

export class WorkspaceService {
  static async get(
    db: Database,
    userId: string,
    id: string,
  ): Promise<Result<WorkspaceRow, AppError>> {
    const member = await assertWorkspaceMembership(db, userId, id);
    if (!member) return { success: false, error: notFound('Workspace not found') };

    const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, id) });
    if (!workspace) return { success: false, error: notFound('Workspace not found') };
    return ok(workspace);
  }

  /** Create a workspace and enroll the creator as its owner. */
  static async create(
    db: Database,
    userId: string,
    name: string,
  ): Promise<Result<WorkspaceRow, AppError>> {
    try {
      const workspace = await db.transaction(async (tx) => {
        const [row] = await tx.insert(workspaces).values({ name }).returning();
        if (!row) throw new Error('insert returned no row');
        await tx.insert(workspaceMembers).values({
          workspaceId: row.id,
          userId,
          role: 'owner',
          joinedAt: new Date(),
        });
        return row;
      });
      return ok(workspace);
    } catch (e) {
      return { success: false, error: internal('Failed to create workspace', { cause: String(e) }) };
    }
  }

  static async members(
    db: Database,
    workspaceId: string,
  ): Promise<Result<MemberWithUser[], AppError>> {
    const rows = await db
      .select({
        member: workspaceMembers,
        user: {
          id: users.id,
          displayName: users.displayName,
          email: users.email,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    return ok(rows.map((r) => ({ ...r.member, user: r.user })));
  }
}
