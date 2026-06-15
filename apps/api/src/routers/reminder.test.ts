import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';
import { insertUser } from '../__tests__/factories/user.factory';
import { createProjectInput } from '../__tests__/factories/project.factory';

let ctx: TestDb;
let world: SeededCouple;

beforeEach(async () => {
  ctx = await createTestDb();
  world = await seedCouple(ctx.db);
});
afterEach(async () => {
  await ctx.close();
});

const futureIso = (daysFromNow: number) =>
  new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();

describe('reminderRouter — create', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = callerFor(ctx.db, null);
    await expect(caller.reminder.create({ remindAt: futureIso(1) })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('creates a standalone reminder (no project or task)', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const reminder = await alex.reminder.create({
      remindAt: new Date('2026-07-02T09:00:00.000Z').toISOString(),
      message: 'Call the dentist',
    });
    expect(reminder.projectId).toBeNull();
    expect(reminder.taskId).toBeNull();
    expect(reminder.message).toBe('Call the dentist');
    expect(reminder.userId).toBe(world.alex.id);

    const list = await alex.reminder.list({});
    expect(list.map((r) => r.id)).toContain(reminder.id);
  });

  it('creates a reminder against a readable project', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Move house' }),
    );
    const reminder = await alex.reminder.create({
      projectId: project.id,
      remindAt: futureIso(2),
    });
    expect(reminder.projectId).toBe(project.id);
  });

  it('creates a reminder against a readable task and inherits its project', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Taxes' }),
    );
    const task = await alex.task.create({ projectId: project.id, title: 'Gather receipts' });
    const reminder = await alex.reminder.create({ taskId: task.id, remindAt: futureIso(3) });
    expect(reminder.taskId).toBe(task.id);
  });

  it('rejects a reminder against a non-existent task', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await expect(
      alex.reminder.create({ taskId: world.workspace.id, remindAt: futureIso(1) }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it("rejects a reminder against the partner's private project", async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const secret = await alex.project.create(
      createProjectInput({
        workspaceId: world.workspace.id,
        title: 'Surprise',
        visibility: 'private',
      }),
    );
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    await expect(
      jordan.reminder.create({ projectId: secret.id, remindAt: futureIso(1) }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('reminderRouter — list', () => {
  it("lists only the caller's own reminders", async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const mine = await alex.reminder.create({ remindAt: futureIso(1), message: 'mine' });
    await jordan.reminder.create({ remindAt: futureIso(1), message: 'theirs' });

    const list = await alex.reminder.list({});
    expect(list.map((r) => r.id)).toEqual([mine.id]);
  });

  it('orders reminders soonest-first', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const later = await alex.reminder.create({ remindAt: futureIso(5), message: 'later' });
    const sooner = await alex.reminder.create({ remindAt: futureIso(1), message: 'sooner' });
    const list = await alex.reminder.list({});
    expect(list.map((r) => r.id)).toEqual([sooner.id, later.id]);
  });
});

describe('reminderRouter — snooze & dismiss', () => {
  it('snooze pushes remindAt-via-snoozedUntil and keeps it unsent', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const reminder = await alex.reminder.create({ remindAt: futureIso(1) });
    const snoozed = await alex.reminder.snooze({
      id: reminder.id,
      snoozeUntil: futureIso(7),
    });
    expect(snoozed.snoozedUntil).not.toBeNull();
    expect(snoozed.isSent).toBe(false);
  });

  it('rejects snoozing a reminder that is not yours', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const reminder = await alex.reminder.create({ remindAt: futureIso(1) });
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    await expect(
      jordan.reminder.snooze({ id: reminder.id, snoozeUntil: futureIso(2) }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('dismiss removes the reminder', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const reminder = await alex.reminder.create({ remindAt: futureIso(1) });
    await alex.reminder.dismiss({ id: reminder.id });
    const list = await alex.reminder.list({});
    expect(list.map((r) => r.id)).not.toContain(reminder.id);
  });

  it('rejects dismissing a reminder that is not yours', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const reminder = await alex.reminder.create({ remindAt: futureIso(1) });
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    await expect(jordan.reminder.dismiss({ id: reminder.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects snoozing a non-existent reminder', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await expect(
      caller.reminder.snooze({ id: world.workspace.id, snoozeUntil: futureIso(1) }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
