import './load-env';
import { createServer } from 'node:http';
import { createHTTPHandler } from '@trpc/server/adapters/standalone';
import { appRouter } from './routers';
import { createContext } from './trpc';
import { handleClerkWebhook } from './webhooks/clerk';

const PORT = Number(process.env['PORT'] ?? 3001);
const WEB_ORIGIN = process.env['WEB_ORIGIN'] ?? '*';

const trpcHandler = createHTTPHandler({ router: appRouter, createContext });

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

  trpcHandler(req, res);
});

server.listen(PORT);
console.log(`LifeSync API listening on http://localhost:${PORT}`);

// Type-only re-export so clients get end-to-end inference:
//   import type { AppRouter } from 'api';
export type { AppRouter } from './routers';
