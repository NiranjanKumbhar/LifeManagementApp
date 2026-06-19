import './load-env';
import { createServer } from 'node:http';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import { serve } from 'inngest/node';
import { appRouter } from './routers';
import { createContext } from './trpc';
import { handleClerkWebhook } from './webhooks/clerk';
import {
  inngest,
  deliverReminders,
  sendWeeklyDigest,
  escalateDeadlines,
  spawnRecurringTasks,
  weeklyCleanup,
} from './jobs';

const PORT = Number(process.env['PORT'] ?? 3001);
const WEB_ORIGIN = process.env['WEB_ORIGIN'] ?? '*';

const trpcHandler = createHTTPHandler({ router: appRouter, createContext });

const inngestHandler = serve({
  client: inngest,
  functions: [deliverReminders, sendWeeklyDigest, escalateDeadlines, spawnRecurringTasks, weeklyCleanup],
});

const server = createServer((req, res) => {
  // CORS — restrict to the configured web origin in production.
  res.setHeader('Access-Control-Allow-Origin', WEB_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Clerk webhooks (Svix-signed) are handled outside tRPC.
  if (req.url && req.url.startsWith('/webhooks/clerk')) {
    void handleClerkWebhook(req, res);
    return;
  }

  // Inngest function serving — Inngest cloud calls this to invoke/introspect functions.
  if (req.url && req.url.startsWith('/api/inngest')) {
    return inngestHandler(req, res);
  }

  trpcHandler(req, res);
});

server.listen(PORT);
console.log(`LifeSync API listening on http://localhost:${PORT}`);

// Type-only re-export so clients get end-to-end inference:
//   import type { AppRouter } from 'api';
export type { AppRouter } from './routers';
