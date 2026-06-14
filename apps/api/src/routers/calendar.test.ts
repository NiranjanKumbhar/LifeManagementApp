import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';
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

const RANGE = { from: '2026-07-01', to: '2026-07-31' };

describe('calendarRouter.list', () => {
  it('aggregates project due dates, task due dates, birthdays, and reminders in range', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Passport', dueDate: '2026-07-20' }),
    );
    await alex.task.create({ projectId: project.id, title: 'Book appointment', dueDate: '2026-07-10' });
    await alex.person.create({ workspaceId: world.workspace.id, name: 'Mum', birthday: '1960-07-14' });
    await alex.reminder.create({
      remindAt: new Date('2026-07-02T09:00:00.000Z').toISOString(),
      message: 'Start passport',
    });

    const items = await alex.calendar.list({ workspaceId: world.workspace.id, ...RANGE });
    const kinds = items.map((i) => i.kind);
    expect(kinds).toContain('project_due');
    expect(kinds).toContain('task_due');
    expect(kinds).toContain('birthday');
    expect(kinds).toContain('reminder');
    expect(items.find((i) => i.kind === 'birthday')?.date).toBe('2026-07-14');
    expect(items.find((i) => i.kind === 'project_due')?.date).toBe('2026-07-20');
  });

  it("hides a private project's due date from a non-owner", async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.project.create(
      createProjectInput({
        workspaceId: world.workspace.id,
        title: 'Secret',
        dueDate: '2026-07-15',
        visibility: 'private',
      }),
    );
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const items = await jordan.calendar.list({ workspaceId: world.workspace.id, ...RANGE });
    expect(items.find((i) => i.title === 'Secret')).toBeUndefined();
  });
});
