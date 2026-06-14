import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';

let ctx: TestDb;
let world: SeededCouple;

beforeEach(async () => {
  ctx = await createTestDb();
  world = await seedCouple(ctx.db);
});
afterEach(async () => {
  await ctx.close();
});

describe('reminderRouter.create (standalone)', () => {
  it('creates a reminder with no project or task', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const reminder = await alex.reminder.create({
      remindAt: new Date('2026-07-02T09:00:00.000Z').toISOString(),
      message: 'Call the dentist',
    });
    expect(reminder.projectId).toBeNull();
    expect(reminder.taskId).toBeNull();
    expect(reminder.message).toBe('Call the dentist');

    const list = await alex.reminder.list({});
    expect(list.map((r) => r.id)).toContain(reminder.id);
  });
});
