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

describe('personRouter — list', () => {
  it('rejects unauthenticated callers', async () => {
    const caller = callerFor(ctx.db, null);
    await expect(caller.person.list({ workspaceId: world.workspace.id })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects a non-member listing people', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await expect(caller.person.list({ workspaceId: world.workspace.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('lists all people in the workspace alphabetically', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.person.create({ workspaceId: world.workspace.id, name: 'Zara' });
    await alex.person.create({ workspaceId: world.workspace.id, name: 'Aaron' });
    const list = await alex.person.list({ workspaceId: world.workspace.id });
    const names = list.map((p) => p.name);
    expect(names.indexOf('Aaron')).toBeLessThan(names.indexOf('Zara'));
  });

  it('both partners see the same person list (shared workspace)', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const person = await alex.person.create({ workspaceId: world.workspace.id, name: 'Grandma' });

    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const list = await jordan.person.list({ workspaceId: world.workspace.id });
    expect(list.map((p) => p.id)).toContain(person.id);
  });
});

describe('personRouter — get', () => {
  it('returns a person for a member', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const created = await alex.person.create({
      workspaceId: world.workspace.id,
      name: 'Uncle Bob',
      relationship: 'uncle',
      birthday: '1960-03-15',
    });
    const fetched = await alex.person.get({ id: created.id });
    expect(fetched.name).toBe('Uncle Bob');
    expect(fetched.relationship).toBe('uncle');
    expect(fetched.birthday).toBe('1960-03-15');
    expect(fetched.projects).toEqual([]);
  });

  it('returns NOT_FOUND for a non-member', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const person = await alex.person.create({ workspaceId: world.workspace.id, name: 'Secret' });
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await expect(caller.person.get({ id: person.id })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('personRouter — create', () => {
  it('creates a person with full contact details', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const person = await alex.person.create({
      workspaceId: world.workspace.id,
      name: 'Aunt Jane',
      relationship: 'aunt',
      email: 'jane@example.com',
      phone: '+1 555 123 4567',
      notes: 'Loves gardening',
      giftIdeas: [{ idea: 'Garden gloves', budget: 25 }],
    });
    expect(person.name).toBe('Aunt Jane');
    expect(person.email).toBe('jane@example.com');
    expect(person.giftIdeas).toHaveLength(1);
    expect(person.giftIdeas[0]).toMatchObject({ idea: 'Garden gloves' });
  });

  it('rejects create from a non-member', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await expect(
      caller.person.create({ workspaceId: world.workspace.id, name: 'Hijack' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('personRouter — update', () => {
  it('updates a person and the change is visible to the partner', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const person = await alex.person.create({ workspaceId: world.workspace.id, name: 'Old Name' });
    const updated = await alex.person.update({ id: person.id, name: 'New Name', notes: 'Updated' });
    expect(updated.name).toBe('New Name');
    expect(updated.notes).toBe('Updated');

    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const fetched = await jordan.person.get({ id: person.id });
    expect(fetched.name).toBe('New Name');
  });

  it('returns NOT_FOUND when a non-member tries to update', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const person = await alex.person.create({ workspaceId: world.workspace.id, name: 'Alex Person' });
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await expect(caller.person.update({ id: person.id, name: 'Hijack' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('personRouter — delete', () => {
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
