import { TRPCError } from '@trpc/server';
import { verifyToken } from '@clerk/backend';
import { eq } from 'drizzle-orm';
import { middleware, publicProcedure } from '../trpc';
import { users } from '../db/schema';
import { UserProvisioningService } from '../services/user-provisioning.service';

/**
 * Authentication middleware. Verifies the Clerk-issued JWT and resolves it
 * to a LifeSync user, augmenting the context with `userId` and `clerkId`.
 */
export const isAuthed = middleware(async ({ ctx, next }) => {
  if (!ctx.authToken) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Missing authentication token' });
  }

  const secretKey = process.env['CLERK_SECRET_KEY'];
  if (!secretKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Auth is not configured',
    });
  }

  let clerkId: string;
  try {
    const payload = await verifyToken(ctx.authToken, { secretKey });
    clerkId = payload.sub;
  } catch {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid or expired token' });
  }

  // Resolve the local user, provisioning them on first sight (JIT) so a freshly
  // signed-up Clerk account works without waiting on the webhook.
  let user = await ctx.db.query.users.findFirst({ where: eq(users.clerkId, clerkId) });
  if (!user) {
    user = await UserProvisioningService.provisionFromClerkId(ctx.db, clerkId);
  }

  if (!user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'No account for this identity' });
  }

  return next({ ctx: { userId: user.id, clerkId } });
});

/** Procedure requiring a valid, authenticated user. */
export const protectedProcedure = publicProcedure.use(isAuthed);
