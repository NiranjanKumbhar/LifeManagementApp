import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UserProvisioningService } from './user-provisioning.service';
import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { insertUser } from '../__tests__/factories/user.factory';
import { users, workspaceMembers, workspaces } from '../db/schema';

let ctx: TestDb;

beforeEach(async () => {
  // This path is only exercised when no default workspace is configured.
  delete process.env['DEFAULT_WORKSPACE_ID'];
  ctx = await createTestDb();
});

afterEach(async () => {
  await ctx.close();
});

describe('UserProvisioningService.ensureOwnWorkspace', () => {
  it('creates a personal workspace the user owns when they have no membership', async () => {
    const user = await insertUser(ctx.db, { displayName: 'Alice Smith' });

    await UserProvisioningService.ensureOwnWorkspace(ctx.db, user);

    const memberships = await ctx.db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.userId, user.id),
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]?.role).toBe('owner');

    const workspace = await ctx.db.query.workspaces.findFirst({
      where: eq(workspaces.id, memberships[0]!.workspaceId),
    });
    expect(workspace?.name.endsWith('Home')).toBe(true);
  });

  it('is idempotent: calling it again does not create a second membership', async () => {
    const user = await insertUser(ctx.db, { displayName: 'Bob Jones' });

    await UserProvisioningService.ensureOwnWorkspace(ctx.db, user);
    await UserProvisioningService.ensureOwnWorkspace(ctx.db, user);

    const memberships = await ctx.db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.userId, user.id),
    });
    expect(memberships).toHaveLength(1);
  });
});

describe('UserProvisioningService.upsertFromWebhook', () => {
  it('reclaims an existing row when re-signing up with the same email (new clerkId)', async () => {
    await ctx.db
      .insert(users)
      .values({ clerkId: 'old_clerk', email: 'reuse@example.com', displayName: 'Old' });

    await UserProvisioningService.upsertFromWebhook(ctx.db, {
      id: 'new_clerk',
      email_addresses: [{ id: 'e1', email_address: 'reuse@example.com' }],
      primary_email_address_id: 'e1',
      first_name: 'Re',
      last_name: 'Used',
    });

    const rows = await ctx.db.select().from(users).where(eq(users.email, 'reuse@example.com'));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.clerkId).toBe('new_clerk');
  });
});

describe('UserProvisioningService.ensureOwnWorkspace (no DEFAULT_WORKSPACE_ID)', () => {
  it('always creates a personal workspace for a brand-new user (no DEFAULT join)', async () => {
    delete process.env['DEFAULT_WORKSPACE_ID'];
    const user = await insertUser(ctx.db);

    await UserProvisioningService.ensureOwnWorkspace(ctx.db, user);

    const memberships = await ctx.db
      .select({ role: workspaceMembers.role, name: workspaces.name })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId, user.id));
    expect(memberships).toHaveLength(1);
    expect(memberships[0]!.role).toBe('owner');
    expect(memberships[0]!.name).toMatch(/Home$/);
  });
});
