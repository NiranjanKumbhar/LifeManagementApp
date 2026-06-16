import { router, unwrap } from '../trpc';
import { protectedProcedure } from '../middleware/auth';
import { workspaceProcedure } from '../middleware/workspace';
import { WorkspaceService } from '../services/workspace.service';
import {
  acceptInviteSchema,
  changeRoleSchema,
  createInviteSchema,
  createWorkspaceSchema,
  inviteIdSchema,
  invitePreviewSchema,
  leaveSchema,
  listInvitesSchema,
  membersSchema,
  removeMemberSchema,
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

  createInvite: workspaceProcedure.input(createInviteSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.createInvite(ctx.db, ctx.userId, input));
  }),
  invitePreview: protectedProcedure.input(invitePreviewSchema).query(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.invitePreview(ctx.db, ctx.userId, input.token));
  }),
  acceptInvite: protectedProcedure.input(acceptInviteSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.acceptInvite(ctx.db, ctx.userId, input.token));
  }),
  revokeInvite: protectedProcedure.input(inviteIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.revokeInvite(ctx.db, ctx.userId, input.id));
  }),
  listInvites: workspaceProcedure.input(listInvitesSchema).query(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.listInvites(ctx.db, ctx.userId, input.workspaceId));
  }),

  changeRole: workspaceProcedure.input(changeRoleSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.changeRole(ctx.db, ctx.userId, input));
  }),
  removeMember: workspaceProcedure.input(removeMemberSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.removeMember(ctx.db, ctx.userId, input));
  }),
  leave: workspaceProcedure.input(leaveSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.leave(ctx.db, ctx.userId, input));
  }),
});
