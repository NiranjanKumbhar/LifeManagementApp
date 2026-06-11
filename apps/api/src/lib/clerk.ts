import { createClerkClient } from '@clerk/backend';

/**
 * Clerk backend client, used to fetch a user's profile when provisioning
 * them into the database for the first time (JIT, in the auth middleware).
 */
export const clerkClient = createClerkClient({
  secretKey: process.env['CLERK_SECRET_KEY'] ?? '',
});
