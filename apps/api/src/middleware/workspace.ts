import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { middleware } from '../trpc';
import { protectedProcedure } from './auth';
import { workspaceMembers } from '../db/schema';
import type { Database } from '../db/client';

/**
 * Confirms the authenticated user belongs to a given workspace.
 * Shared by middleware and by services that resolve a workspace from an entity id.
 */
export async function assertWorkspaceMembership(
  db: Database,
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId),
    ),
  });
  return Boolean(membership);
}

/**
 * Workspace authorization middleware. Reads `workspaceId` from the procedure
 * input and rejects requests from non-members. Augments context with `workspaceId`.
 *
 * Use for procedures whose input carries a `workspaceId` (list, create, dashboard).
 * For id-based procedures (get/update/etc.), the service resolves the workspace
 * from the entity and calls `assertWorkspaceMembership` directly.
 */
export const enforceWorkspaceMembership = middleware(async ({ ctx, next, getRawInput }) => {
  const raw = (await getRawInput()) as { workspaceId?: unknown } | null;
  const workspaceId = raw?.workspaceId;

  if (typeof workspaceId !== 'string') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'workspaceId is required' });
  }

  const userId = (ctx as unknown as { userId: string }).userId;
  const isMember = await assertWorkspaceMembership(ctx.db, userId, workspaceId);
  if (!isMember) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this workspace' });
  }

  return next({ ctx: { workspaceId } });
});

/** Procedure that is authenticated AND scoped to a workspace the user belongs to. */
export const workspaceProcedure = protectedProcedure.use(enforceWorkspaceMembership);
