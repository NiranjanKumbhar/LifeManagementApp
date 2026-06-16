import { eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { users, workspaceMembers, workspaces } from '../db/schema';
import { clerkClient } from '../lib/clerk';

type UserRow = typeof users.$inferSelect;

interface UserUpsert {
  clerkId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Shape of the `data` object on a Clerk `user.*` webhook event (snake_case). */
export interface ClerkWebhookUser {
  id: string;
  email_addresses?: Array<{ id: string; email_address: string }>;
  primary_email_address_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  image_url?: string | null;
}

function displayNameFrom(
  first: string | null | undefined,
  last: string | null | undefined,
  username: string | null | undefined,
  email: string,
): string {
  const full = [first, last].filter(Boolean).join(' ').trim();
  return full || username || email.split('@')[0] || email;
}

async function upsertUser(db: Database, input: UserUpsert): Promise<UserRow> {
  const [user] = await db
    .insert(users)
    .values({
      clerkId: input.clerkId,
      email: input.email,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
    })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: {
        email: input.email,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        updatedAt: new Date(),
      },
    })
    .returning();
  // `user` is always defined: insert-or-update returns exactly one row.
  return user as UserRow;
}

export class UserProvisioningService {
  /**
   * Guarantee the user belongs to at least one workspace. If they already do,
   * no-op. In dev with DEFAULT_WORKSPACE_ID set, join that (legacy convenience).
   * Otherwise create a personal workspace they own.
   */
  static async ensureOwnWorkspace(db: Database, user: UserRow): Promise<void> {
    const existing = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, user.id),
    });
    if (existing) return;

    const defaultId = process.env['DEFAULT_WORKSPACE_ID'];
    if (defaultId && process.env['NODE_ENV'] !== 'production') {
      const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, defaultId) });
      if (ws) {
        await db
          .insert(workspaceMembers)
          .values({ workspaceId: defaultId, userId: user.id, role: 'member', joinedAt: new Date() })
          .onConflictDoNothing();
        return;
      }
    }

    const firstName = user.displayName.split(' ')[0] || user.displayName;
    await db.transaction(async (tx) => {
      const [ws] = await tx.insert(workspaces).values({ name: `${firstName}'s Home` }).returning();
      if (!ws) throw new Error('workspace insert returned no row');
      await tx.insert(workspaceMembers).values({
        workspaceId: ws.id,
        userId: user.id,
        role: 'owner',
        joinedAt: new Date(),
      });
    });
  }

  /**
   * Just-in-time provisioning: look up the Clerk profile by id, upsert it into
   * the users table, and ensure default workspace membership. Returns the row,
   * or `undefined` if the Clerk user can't be fetched.
   */
  static async provisionFromClerkId(
    db: Database,
    clerkId: string,
  ): Promise<UserRow | undefined> {
    let clerkUser: Awaited<ReturnType<typeof clerkClient.users.getUser>>;
    try {
      clerkUser = await clerkClient.users.getUser(clerkId);
    } catch {
      return undefined;
    }

    const primary =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId) ??
      clerkUser.emailAddresses[0];
    const email = primary?.emailAddress;
    if (!email) return undefined;

    const user = await upsertUser(db, {
      clerkId,
      email,
      displayName: displayNameFrom(
        clerkUser.firstName,
        clerkUser.lastName,
        clerkUser.username,
        email,
      ),
      avatarUrl: clerkUser.imageUrl ?? null,
    });
    await UserProvisioningService.ensureOwnWorkspace(db, user);
    return user;
  }

  /** Apply a Clerk `user.created` / `user.updated` webhook payload. */
  static async upsertFromWebhook(db: Database, data: ClerkWebhookUser): Promise<void> {
    const list = data.email_addresses ?? [];
    const primary = list.find((e) => e.id === data.primary_email_address_id) ?? list[0];
    const email = primary?.email_address;
    if (!data.id || !email) return;

    const user = await upsertUser(db, {
      clerkId: data.id,
      email,
      displayName: displayNameFrom(data.first_name, data.last_name, data.username, email),
      avatarUrl: data.image_url ?? null,
    });
    await UserProvisioningService.ensureOwnWorkspace(db, user);
  }
}
