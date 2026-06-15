import type { IncomingMessage, ServerResponse } from 'node:http';
import { Webhook } from 'svix';
import { db } from '../db/client';
import {
  UserProvisioningService,
  type ClerkWebhookUser,
} from '../services/user-provisioning.service';

interface ClerkWebhookEvent {
  type: string;
  data: ClerkWebhookUser;
}

function readRawBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'content-type': 'text/plain' });
  res.end(body);
}

/**
 * Next.js App Router variant: accepts a Web Fetch `Request`, returns a `Response`.
 * Same verification + sync logic as `handleClerkWebhook`.
 */
export async function handleClerkWebhookFetch(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const secret = process.env['CLERK_WEBHOOK_SECRET'];
  if (!secret) {
    return new Response('Webhook not configured', { status: 503 });
  }

  const payload = await req.text();
  const headers = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  };

  let event: ClerkWebhookEvent;
  try {
    event = new Webhook(secret).verify(payload, headers) as ClerkWebhookEvent;
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'user.created':
      case 'user.updated':
        await UserProvisioningService.upsertFromWebhook(db, event.data);
        break;
    }
    return new Response('ok', { status: 200 });
  } catch {
    return new Response('Sync failed', { status: 500 });
  }
}

/**
 * Verifies a Clerk (Svix-signed) webhook and syncs the user into the database.
 * Handles `user.created` and `user.updated`; other events are acknowledged.
 */
export async function handleClerkWebhook(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    send(res, 405, 'Method not allowed');
    return;
  }

  const secret = process.env['CLERK_WEBHOOK_SECRET'];
  if (!secret) {
    send(res, 503, 'Webhook not configured');
    return;
  }

  const payload = await readRawBody(req);
  const headers = {
    'svix-id': String(req.headers['svix-id'] ?? ''),
    'svix-timestamp': String(req.headers['svix-timestamp'] ?? ''),
    'svix-signature': String(req.headers['svix-signature'] ?? ''),
  };

  let event: ClerkWebhookEvent;
  try {
    event = new Webhook(secret).verify(payload, headers) as ClerkWebhookEvent;
  } catch {
    send(res, 400, 'Invalid signature');
    return;
  }

  try {
    switch (event.type) {
      case 'user.created':
      case 'user.updated':
        await UserProvisioningService.upsertFromWebhook(db, event.data);
        break;
      default:
        // user.deleted and others: acknowledged but intentionally not acted on
        // (deleting a user with owned projects would violate FK constraints).
        break;
    }
    send(res, 200, 'ok');
  } catch {
    send(res, 500, 'Sync failed');
  }
}
