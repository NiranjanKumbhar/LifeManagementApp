import { router, unwrap } from '../trpc';
import { protectedProcedure } from '../middleware/auth';
import { AccountService } from '../services/account.service';
import { clerkClient } from '../lib/clerk';

export const accountRouter = router({
  /** Permanently delete the caller's account + data, then remove the Clerk user. */
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    // DB first — throws on failure so the Clerk user is left intact to retry.
    unwrap(await AccountService.deleteAccount(ctx.db, ctx.userId));
    try {
      await clerkClient.users.deleteUser(ctx.clerkId);
    } catch {
      // Best-effort: the DB is already clean; a Clerk-side failure isn't fatal.
    }
  }),

  /** Delete the caller's solo-owned workspaces and leave shared ones; keep the account. */
  clearData: protectedProcedure.mutation(async ({ ctx }) => {
    unwrap(await AccountService.clearData(ctx.db, ctx.userId));
  }),
});
