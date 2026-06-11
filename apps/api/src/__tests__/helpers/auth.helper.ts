import { appRouter } from '../../routers';
import type { Database } from '../../db/client';

/**
 * Build a tRPC caller bound to a test db and an auth token.
 *
 * The router tests mock `@clerk/backend` so that `verifyToken(token)` resolves
 * to `{ sub: token }` — i.e. the auth token IS the user's clerkId. Pass a
 * seeded user's `clerkId` to act as that user, or `null` to be unauthenticated.
 */
export function callerFor(db: Database, authToken: string | null) {
  return appRouter.createCaller({ db, authToken });
}
