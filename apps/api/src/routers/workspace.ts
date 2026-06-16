import { TRPCError } from '@trpc/server';
import { router, unwrap } from '../trpc';
import { protectedProcedure } from '../middleware/auth';
import { workspaceProcedure } from '../middleware/workspace';
import { WorkspaceService } from '../services/workspace.service';
import {
  createWorkspaceSchema,
  inviteSchema,
  membersSchema,
  workspaceGetSchema,
} from '../utils/validation';

export const workspaceRouter = router({
  get: protectedProcedure.input(workspaceGetSchema).query(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.get(ctx.db, ctx.userId, input.id));
  }),

  create: protectedProcedure.input(createWorkspaceSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.create(ctx.db, ctx.userId, input.name));
  }),

  members: workspaceProcedure.input(membersSchema).query(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.members(ctx.db, input.workspaceId));
  }),

  mine: protectedProcedure.query(async ({ ctx }) => {
    return unwrap(await WorkspaceService.mine(ctx.db, ctx.userId));
  }),

  // Partner invites are delegated to Clerk Organizations and are not yet wired up.
  invite: workspaceProcedure.input(inviteSchema).mutation(() => {
    throw new TRPCError({
      code: 'NOT_IMPLEMENTED',
      message: 'Workspace invites require Clerk Organizations integration (pending)',
    });
  }),
});
