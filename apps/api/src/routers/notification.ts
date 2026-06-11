import { router, unwrap } from '../trpc';
import { protectedProcedure } from '../middleware/auth';
import { NotificationService } from '../services/notification.service';
import { listNotificationsSchema, notificationIdSchema } from '../utils/validation';

export const notificationRouter = router({
  list: protectedProcedure.input(listNotificationsSchema).query(async ({ ctx, input }) => {
    return unwrap(await NotificationService.list(ctx.db, ctx.userId, input.unreadOnly ?? false));
  }),

  markRead: protectedProcedure.input(notificationIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await NotificationService.markRead(ctx.db, ctx.userId, input.id));
  }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    return unwrap(await NotificationService.markAllRead(ctx.db, ctx.userId));
  }),
});
