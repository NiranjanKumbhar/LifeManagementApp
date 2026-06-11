import { router, unwrap } from '../trpc';
import { protectedProcedure } from '../middleware/auth';
import { workspaceProcedure } from '../middleware/workspace';
import { ProjectService } from '../services/project.service';
import {
  createProjectSchema,
  listProjectsSchema,
  projectIdSchema,
  updateProjectSchema,
  workspaceIdSchema,
} from '../utils/validation';

/**
 * Project router — thin I/O layer over ProjectService.
 *
 * Procedures whose input carries `workspaceId` use `workspaceProcedure`
 * (membership enforced by middleware). Id-based procedures use
 * `protectedProcedure` and let the service resolve and authorize the workspace.
 */
export const projectRouter = router({
  list: workspaceProcedure.input(listProjectsSchema).query(async ({ ctx, input }) => {
    return unwrap(await ProjectService.list(ctx.db, ctx.userId, input));
  }),

  get: protectedProcedure.input(projectIdSchema).query(async ({ ctx, input }) => {
    return unwrap(await ProjectService.get(ctx.db, ctx.userId, input.id));
  }),

  create: workspaceProcedure.input(createProjectSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await ProjectService.create(ctx.db, ctx.userId, input));
  }),

  update: protectedProcedure.input(updateProjectSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await ProjectService.update(ctx.db, ctx.userId, input));
  }),

  complete: protectedProcedure.input(projectIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await ProjectService.complete(ctx.db, ctx.userId, input.id));
  }),

  archive: protectedProcedure.input(projectIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await ProjectService.archive(ctx.db, ctx.userId, input.id));
  }),

  dashboard: workspaceProcedure.input(workspaceIdSchema).query(async ({ ctx, input }) => {
    return unwrap(await ProjectService.dashboard(ctx.db, ctx.userId, input.workspaceId));
  }),
});
