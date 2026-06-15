import { handleClerkWebhookFetch } from 'api/server';

export async function POST(req: Request): Promise<Response> {
  return handleClerkWebhookFetch(req);
}
