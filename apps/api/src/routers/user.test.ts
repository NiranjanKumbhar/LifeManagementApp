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

describe('userRouter — me', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = callerFor(ctx.db, null);
    await expect(caller.user.me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('returns the current user profile', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const me = await alex.user.me();
    expect(me.id).toBe(world.alex.id);
    expect(me.displayName).toBe('Alex');
    expect(me.clerkId).toBe(world.alex.clerkId);
  });
});

describe('userRouter — updateProfile', () => {
  it('updates displayName and timezone', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const updated = await alex.user.updateProfile({
      displayName: 'Alex Updated',
      timezone: 'America/Chicago',
    });
    expect(updated.displayName).toBe('Alex Updated');
    expect(updated.timezone).toBe('America/Chicago');
  });

  it('a no-field update returns the existing profile', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const updated = await alex.user.updateProfile({});
    expect(updated.id).toBe(world.alex.id);
    expect(updated.displayName).toBe('Alex');
  });

  it('does not affect the partner profile', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.user.updateProfile({ displayName: 'Alex Renamed' });

    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const jordanMe = await jordan.user.me();
    expect(jordanMe.displayName).toBe('Jordan');
  });
});

describe('userRouter — updateNotificationPrefs', () => {
  it('saves notification preferences', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const updated = await alex.user.updateNotificationPrefs({
      preferences: {
        digestMode: 'daily',
        channels: { push: true, email: false, inApp: true },
        quietHours: { start: '22:00', end: '07:00' },
      },
    });
    expect(updated.notificationPreferences).toMatchObject({
      digestMode: 'daily',
      channels: { push: true, email: false, inApp: true },
      quietHours: { start: '22:00', end: '07:00' },
    });
  });

  it('partial preferences overwrites the stored object', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.user.updateNotificationPrefs({
      preferences: { digestMode: 'weekly' },
    });
    const me = await alex.user.me();
    expect((me.notificationPreferences as Record<string, unknown>)?.digestMode).toBe('weekly');
  });
});

describe('userRouter — completeOnboarding', () => {
  it('stamps onboardedAt on the current user', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const before = await alex.user.me();
    expect(before.onboardedAt).toBeNull();

    const after = await alex.user.completeOnboarding();
    expect(after.onboardedAt).not.toBeNull();

    const reloaded = await alex.user.me();
    expect(reloaded.onboardedAt).not.toBeNull();
  });
});
