import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const { deleteUser } = vi.hoisted(() => ({ deleteUser: vi.fn() }));
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn(), deleteUser } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';
import { insertUser } from '../__tests__/factories/user.factory';
import { users } from '../db/schema';

let ctx: TestDb;

beforeEach(async () => {
  ctx = await createTestDb();
  vi.clearAllMocks();
});
afterEach(async () => {
  await ctx.close();
});

describe('accountRouter', () => {
  it('clearData removes the caller’s solo workspace but keeps the account', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await caller.workspace.create({ name: 'Solo' });

    await caller.account.clearData();

    expect(await caller.workspace.mine()).toEqual([]);
    expect(await ctx.db.select().from(users).where(eq(users.id, stranger.id))).toHaveLength(1);
  });

  it('delete removes the account row and calls Clerk deleteUser', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await caller.workspace.create({ name: 'Solo' });

    await caller.account.delete();

    expect(await ctx.db.select().from(users).where(eq(users.id, stranger.id))).toHaveLength(0);
    expect(deleteUser).toHaveBeenCalledWith(stranger.clerkId);
  });
});
