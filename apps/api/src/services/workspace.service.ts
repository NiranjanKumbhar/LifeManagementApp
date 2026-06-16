import { and, asc, count, desc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import type { Database } from '../db/client';
import { users, workspaceInvites, workspaceMembers, workspaces } from '../db/schema';
import {
  conflict,
  forbidden,
  internal,
  notFound,
  ok,
  type AppError,
  type Result,
} from '../utils/errors';
import { assertWorkspaceMembership } from '../middleware/workspace';

type WorkspaceRow = typeof workspaces.$inferSelect;
type MemberRow = typeof workspaceMembers.$inferSelect;
type InviteRow = typeof workspaceInvites.$inferSelect;

const MAX_MEMBERS = 6;

export interface MemberWithUser extends MemberRow {
  user: { id: string; displayName: string; email: string; avatarUrl: string | null };
}

export interface MyWorkspace {
  workspace: WorkspaceRow;
  role: 'owner' | 'member';
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

  static async mine(db: Database, userId: string): Promise<Result<MyWorkspace[], AppError>> {
    const rows = await db
      .select({ workspace: workspaces, role: workspaceMembers.role })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, userId))
      .orderBy(asc(workspaces.createdAt));
    return ok(rows.map((r) => ({ workspace: r.workspace, role: r.role })));
  }

  private static async requireOwner(
    db: Database,
    userId: string,
    workspaceId: string,
  ): Promise<Result<true, AppError>> {
    const m = await db.query.workspaceMembers.findFirst({
      where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
    });
    if (!m) return { success: false, error: notFound('Workspace not found') };
    if (m.role !== 'owner') return { success: false, error: forbidden('Only the owner can manage invites') };
    return ok(true);
  }

  static async createInvite(
    db: Database,
    userId: string,
    input: { workspaceId: string; email?: string },
  ): Promise<Result<{ invite: InviteRow; joinPath: string }, AppError>> {
    const owner = await this.requireOwner(db, userId, input.workspaceId);
    if (!owner.success) return owner;
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const [invite] = await db
      .insert(workspaceInvites)
      .values({
        workspaceId: input.workspaceId,
        token,
        email: input.email ?? null,
        invitedBy: userId,
        expiresAt,
      })
      .returning();
    if (!invite) return { success: false, error: internal('Invite creation failed') };
    return ok({ invite, joinPath: `/join/${token}` });
  }

  static async invitePreview(
    db: Database,
    _userId: string,
    token: string,
  ): Promise<Result<{ workspaceName: string; status: string }, AppError>> {
    const invite = await db.query.workspaceInvites.findFirst({ where: eq(workspaceInvites.token, token) });
    if (!invite) return { success: false, error: notFound('Invite not found') };
    const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, invite.workspaceId) });
    if (!ws) return { success: false, error: notFound('Invite not found') };
    return ok({ workspaceName: ws.name, status: invite.status });
  }

  static async acceptInvite(
    db: Database,
    userId: string,
    token: string,
  ): Promise<Result<WorkspaceRow, AppError>> {
    const invite = await db.query.workspaceInvites.findFirst({ where: eq(workspaceInvites.token, token) });
    if (!invite) return { success: false, error: notFound('Invite not found') };
    if (invite.status === 'revoked') return { success: false, error: notFound('Invite not found') };
    if (invite.status === 'pending' && invite.expiresAt < new Date()) {
      await db.update(workspaceInvites).set({ status: 'expired' }).where(eq(workspaceInvites.id, invite.id));
      return { success: false, error: notFound('Invite has expired') };
    }
    const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, invite.workspaceId) });
    if (!ws) return { success: false, error: notFound('Workspace not found') };

    const already = await db.query.workspaceMembers.findFirst({
      where: and(eq(workspaceMembers.workspaceId, invite.workspaceId), eq(workspaceMembers.userId, userId)),
    });
    if (already) {
      if (invite.status === 'pending') {
        await db
          .update(workspaceInvites)
          .set({ status: 'accepted', acceptedBy: userId, acceptedAt: new Date() })
          .where(eq(workspaceInvites.id, invite.id));
      }
      return ok(ws);
    }

    const [row] = await db
      .select({ value: count() })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, invite.workspaceId));
    if ((row?.value ?? 0) >= MAX_MEMBERS) return { success: false, error: conflict('Workspace is full') };

    await db.transaction(async (tx) => {
      await tx.insert(workspaceMembers).values({
        workspaceId: invite.workspaceId,
        userId,
        role: invite.role,
        joinedAt: new Date(),
      });
      await tx
        .update(workspaceInvites)
        .set({ status: 'accepted', acceptedBy: userId, acceptedAt: new Date() })
        .where(eq(workspaceInvites.id, invite.id));
    });
    return ok(ws);
  }

  static async revokeInvite(db: Database, userId: string, id: string): Promise<Result<void, AppError>> {
    const invite = await db.query.workspaceInvites.findFirst({ where: eq(workspaceInvites.id, id) });
    if (!invite) return { success: false, error: notFound('Invite not found') };
    const owner = await this.requireOwner(db, userId, invite.workspaceId);
    if (!owner.success) return owner;
    await db.update(workspaceInvites).set({ status: 'revoked' }).where(eq(workspaceInvites.id, id));
    return ok(undefined);
  }

  static async listInvites(
    db: Database,
    userId: string,
    workspaceId: string,
  ): Promise<Result<InviteRow[], AppError>> {
    const owner = await this.requireOwner(db, userId, workspaceId);
    if (!owner.success) return owner;
    const rows = await db
      .select()
      .from(workspaceInvites)
      .where(and(eq(workspaceInvites.workspaceId, workspaceId), eq(workspaceInvites.status, 'pending')))
      .orderBy(desc(workspaceInvites.createdAt));
    return ok(rows);
  }
}
