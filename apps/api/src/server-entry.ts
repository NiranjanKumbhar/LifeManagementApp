/**
 * Exports consumed by the Next.js API routes (apps/web/src/app/api/**).
 * This file is the `api/server` package subpath — it must NOT import load-env
 * or start any HTTP server. Env vars are provided by Next.js / Vercel.
 */
import { serve } from 'inngest/next';
import { inngest, deliverReminders, sendWeeklyDigest, escalateDeadlines } from './jobs';

export { appRouter } from './routers';
export type { AppRouter } from './routers';
export { createFetchContext } from './trpc';
export { handleClerkWebhookFetch } from './webhooks/clerk';

/** Pre-built Inngest route handlers for the Next.js App Router (`export const { GET, POST, PUT }`). */
export const inngestHandlers = serve({
  client: inngest,
  functions: [deliverReminders, sendWeeklyDigest, escalateDeadlines],
});
