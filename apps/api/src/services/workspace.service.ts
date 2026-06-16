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
      return {
        success: false,
        error: internal('Failed to create workspace', { cause: String(e) }),
      };
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
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    });
    if (!m) return { success: false, error: notFound('Workspace not found') };
    if (m.role !== 'owner')
      return { success: false, error: forbidden('Only an owner can manage this workspace') };
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
    const invite = await db.query.workspaceInvites.findFirst({
      where: eq(workspaceInvites.token, token),
    });
    if (!invite) return { success: false, error: notFound('Invite not found') };
    const ws = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, invite.workspaceId),
    });
    if (!ws) return { success: false, error: notFound('Invite not found') };
    return ok({ workspaceName: ws.name, status: invite.status });
  }

  static async acceptInvite(
    db: Database,
    userId: string,
    token: string,
  ): Promise<Result<WorkspaceRow, AppError>> {
    const invite = await db.query.workspaceInvites.findFirst({
      where: eq(workspaceInvites.token, token),
    });
    if (!invite) return { success: false, error: notFound('Invite not found') };

    const ws = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, invite.workspaceId),
    });
    if (!ws) return { success: false, error: notFound('Workspace not found') };

    // An existing member (including the original accepter re-opening the link)
    // gets an idempotent success — no second membership, no error.
    const already = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, invite.workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    });
    if (already) return ok(ws);

    // For a new joiner the invite must still be actionable: pending + unexpired.
    // (accepted = already consumed by someone else; revoked/expired = dead.)
    if (invite.status !== 'pending') {
      return { success: false, error: notFound('Invite not found') };
    }
    if (invite.expiresAt < new Date()) {
      await db
        .update(workspaceInvites)
        .set({ status: 'expired' })
        .where(eq(workspaceInvites.id, invite.id));
      return { success: false, error: notFound('Invite has expired') };
    }

    // Capacity check then join. Note: this count-then-insert has a benign
    // TOCTOU race (two simultaneous accepts could momentarily exceed the cap);
    // acceptable for a small household app.
    const [row] = await db
      .select({ value: count() })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, invite.workspaceId));
    if ((row?.value ?? 0) >= MAX_MEMBERS) {
      return { success: false, error: conflict('Workspace is full') };
    }

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

  static async revokeInvite(
    db: Database,
    userId: string,
    id: string,
  ): Promise<Result<void, AppError>> {
    const invite = await db.query.workspaceInvites.findFirst({
      where: eq(workspaceInvites.id, id),
    });
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
      .where(
        and(eq(workspaceInvites.workspaceId, workspaceId), eq(workspaceInvites.status, 'pending')),
      )
      .orderBy(desc(workspaceInvites.createdAt));
    return ok(rows);
  }

  private static async countOwners(db: Database, workspaceId: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, 'owner')));
    return row?.value ?? 0;
  }

  static async changeRole(
    db: Database,
    userId: string,
    input: { workspaceId: string; targetUserId: string; role: 'owner' | 'member' },
  ): Promise<Result<MemberRow, AppError>> {
    const owner = await this.requireOwner(db, userId, input.workspaceId);
    if (!owner.success) return owner;

    const target = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ),
    });
    if (!target) return { success: false, error: notFound('Member not found') };
    if (target.role === input.role) return ok(target);

    if (target.role === 'owner' && input.role === 'member' && (await this.countOwners(db, input.workspaceId)) <= 1) {
      return { success: false, error: conflict('Promote another member to owner before stepping down') };
    }

    const [updated] = await db
      .update(workspaceMembers)
      .set({ role: input.role })
      .where(and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ))
      .returning();
    if (!updated) return { success: false, error: internal('Role update failed') };
    return ok(updated);
  }

  static async removeMember(
    db: Database,
    userId: string,
    input: { workspaceId: string; targetUserId: string },
  ): Promise<Result<void, AppError>> {
    const owner = await this.requireOwner(db, userId, input.workspaceId);
    if (!owner.success) return owner;

    const target = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ),
    });
    if (!target) return { success: false, error: notFound('Member not found') };
    if (target.role === 'owner' && (await this.countOwners(db, input.workspaceId)) <= 1) {
      return { success: false, error: conflict('Cannot remove the last owner') };
    }

    await db
      .delete(workspaceMembers)
      .where(and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ));
    return ok(undefined);
  }

  static async leave(
    db: Database,
    userId: string,
    input: { workspaceId: string },
  ): Promise<Result<void, AppError>> {
    const me = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    });
    if (!me) return { success: false, error: notFound('Membership not found') };
    if (me.role === 'owner' && (await this.countOwners(db, input.workspaceId)) <= 1) {
      return { success: false, error: conflict('Make someone else an owner before leaving') };
    }

    await db
      .delete(workspaceMembers)
      .where(and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, userId),
      ));
    return ok(undefined);
  }
}
