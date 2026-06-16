import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UserProvisioningService } from './user-provisioning.service';
import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { insertUser } from '../__tests__/factories/user.factory';
import { workspaceMembers, workspaces } from '../db/schema';

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
