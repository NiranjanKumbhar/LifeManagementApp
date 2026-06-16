import { router, unwrap } from '../trpc';
import { protectedProcedure } from '../middleware/auth';
import { UserService } from '../services/user.service';
import { updateNotificationPrefsSchema, updateProfileSchema } from '../utils/validation';

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return unwrap(await UserService.me(ctx.db, ctx.userId));
  }),

  updateProfile: protectedProcedure.input(updateProfileSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await UserService.updateProfile(ctx.db, ctx.userId, input));
  }),

  updateNotificationPrefs: protectedProcedure
    .input(updateNotificationPrefsSchema)
    .mutation(async ({ ctx, input }) => {
      return unwrap(await UserService.updateNotificationPrefs(ctx.db, ctx.userId, input));
    }),

  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    return unwrap(await UserService.completeOnboarding(ctx.db, ctx.userId));
  }),
});
