import { initTRPC, TRPCError } from '@trpc/server';
import type { CreateHTTPContextOptions } from '@trpc/server/adapters/standalone';
import { db, type Database } from './db/client';
import type { AppError, AppErrorCode, Result } from './utils/errors';

/**
 * Base request context. Auth and workspace middleware progressively
 * augment this (adding `userId`, `clerkId`, `workspaceId`) for downstream
 * procedures via `next({ ctx })`.
 */
export interface Context {
  db: Database;
  /** Raw bearer token from the Authorization header, verified by auth middleware. */
  authToken: string | null;
}

export async function createContext({ req }: CreateHTTPContextOptions): Promise<Context> {
  const header = req.headers['authorization'];
  const authToken =
    typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : null;
  return { db, authToken };
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Surface our AppError code when present, without leaking internals.
        appCode: (error.cause as { appCode?: AppErrorCode } | undefined)?.appCode ?? null,
      },
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure;
export const mergeRouters = t.mergeRouters;

// ── Result → TRPCError bridge ─────────────────────────────────────────────────

const TRPC_CODE: Record<AppErrorCode, TRPCError['code']> = {
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  VALIDATION: 'BAD_REQUEST',
  CONFLICT: 'CONFLICT',
  INTERNAL: 'INTERNAL_SERVER_ERROR',
};

export function toTRPCError(error: AppError): TRPCError {
  return new TRPCError({
    code: TRPC_CODE[error.code],
    message: error.message,
    cause: { appCode: error.code, details: error.details },
  });
}

/** Unwrap a service Result inside a router: returns data or throws a TRPCError. */
export function unwrap<T>(result: Result<T, AppError>): T {
  if (result.success) return result.data;
  throw toTRPCError(result.error);
}
