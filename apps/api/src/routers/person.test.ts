import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';
import { insertUser } from '../__tests__/factories/user.factory';

let ctx: TestDb;
let world: SeededCouple;

beforeEach(async () => {
  ctx = await createTestDb();
  world = await seedCouple(ctx.db);
});
afterEach(async () => {
  await ctx.close();
});

describe('personRouter.delete', () => {
  it('deletes a person for a member', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const person = await alex.person.create({ workspaceId: world.workspace.id, name: 'Mum' });
    await alex.person.delete({ id: person.id });
    const list = await alex.person.list({ workspaceId: world.workspace.id });
    expect(list.map((p) => p.id)).not.toContain(person.id);
  });

  it('rejects delete from a non-member and keeps the row', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const person = await alex.person.create({ workspaceId: world.workspace.id, name: 'Dad' });
    const stranger = await insertUser(ctx.db);
    const strangerCaller = callerFor(ctx.db, stranger.clerkId);
    await expect(strangerCaller.person.delete({ id: person.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const list = await alex.person.list({ workspaceId: world.workspace.id });
    expect(list.map((p) => p.id)).toContain(person.id);
  });
});
