import { router, unwrap } from '../trpc';
import { protectedProcedure } from '../middleware/auth';
import { workspaceProcedure } from '../middleware/workspace';
import { InboxService } from '../services/inbox.service';
import {
  assignInboxSchema,
  captureInboxSchema,
  inboxIdSchema,
  listInboxSchema,
} from '../utils/validation';

export const inboxRouter = router({
  capture: workspaceProcedure.input(captureInboxSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await InboxService.capture(ctx.db, ctx.userId, input));
  }),

  list: workspaceProcedure.input(listInboxSchema).query(async ({ ctx, input }) => {
    return unwrap(await InboxService.list(ctx.db, ctx.userId, input));
  }),

  assignToProject: protectedProcedure
    .input(assignInboxSchema)
    .mutation(async ({ ctx, input }) => {
      return unwrap(await InboxService.assignToProject(ctx.db, ctx.userId, input));
    }),

  dismiss: protectedProcedure.input(inboxIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await InboxService.dismiss(ctx.db, ctx.userId, input.id));
  }),
});
