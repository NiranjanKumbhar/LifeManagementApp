import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Clerk at the boundary: the auth token IS treated as the user's clerkId,
// so `verifyToken(token)` resolves to `{ sub: token }`. Hoisted above imports.
vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';
import { insertUser } from '../__tests__/factories/user.factory';
import { insertWorkspace } from '../__tests__/factories/workspace.factory';
import { addMember } from '../__tests__/factories/user.factory';
import {
  createHouseholdInput,
  insertHouseholdItem,
} from '../__tests__/factories/household.factory';

let ctx: TestDb;
let world: SeededCouple;

beforeEach(async () => {
  ctx = await createTestDb();
  world = await seedCouple(ctx.db);
});

afterEach(async () => {
  await ctx.close();
});

describe('householdRouter — authorization', () => {
  it('rejects unauthenticated list requests', async () => {
    const caller = callerFor(ctx.db, null);
    await expect(caller.household.list({ workspaceId: world.workspace.id })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects a non-member listing the workspace', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await expect(caller.household.list({ workspaceId: world.workspace.id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects a non-member adding an item', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await expect(
      caller.household.add(createHouseholdInput({ workspaceId: world.workspace.id })),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it("hides another workspace's item from update/purchase/restock (NOT_FOUND)", async () => {
    // An item owned by a separate workspace the user is not a member of.
    const otherWs = await insertWorkspace(ctx.db);
    const otherOwner = await insertUser(ctx.db);
    await addMember(ctx.db, otherWs.id, otherOwner.id, 'owner');
    const foreignItem = await insertHouseholdItem(ctx.db, {
      workspaceId: otherWs.id,
      addedBy: otherOwner.id,
    });

    const alex = callerFor(ctx.db, world.alex.clerkId);
    await expect(alex.household.update({ id: foreignItem.id, name: 'Hijack' })).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
    await expect(alex.household.purchase({ id: foreignItem.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(alex.household.restock({ id: foreignItem.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('householdRouter — member flows', () => {
  it('adds an item and lists it for the workspace', async () => {
    const caller = callerFor(ctx.db, world.alex.clerkId);
    const created = await caller.household.add(
      createHouseholdInput({ workspaceId: world.workspace.id, name: 'Olive oil' }),
    );
    expect(created).toMatchObject({ name: 'Olive oil', addedBy: world.alex.id });

    const list = await caller.household.list({ workspaceId: world.workspace.id });
    expect(list.map((i) => i.id)).toContain(created.id);
  });

  it('defaults category to "other" and status to "stocked" when omitted', async () => {
    const caller = callerFor(ctx.db, world.alex.clerkId);
    const created = await caller.household.add({
      workspaceId: world.workspace.id,
      name: 'Mystery item',
    });
    expect(created).toMatchObject({ category: 'other', status: 'stocked' });
  });

  it('filters the list by status', async () => {
    const caller = callerFor(ctx.db, world.alex.clerkId);
    await caller.household.add(
      createHouseholdInput({ workspaceId: world.workspace.id, name: 'Milk', status: 'on_list' }),
    );
    await caller.household.add(
      createHouseholdInput({ workspaceId: world.workspace.id, name: 'Rice', status: 'stocked' }),
    );

    const onList = await caller.household.list({
      workspaceId: world.workspace.id,
      status: 'on_list',
    });
    expect(onList.map((i) => i.name)).toEqual(['Milk']);
  });

  it('purchase marks an item stocked and records lastPurchased + lastPurchasedBy', async () => {
    const caller = callerFor(ctx.db, world.alex.clerkId);
    const item = await caller.household.add(
      createHouseholdInput({ workspaceId: world.workspace.id, name: 'Eggs', status: 'out' }),
    );
    expect(item.lastPurchased).toBeNull();
    expect(item.lastPurchasedBy).toBeNull();

    const purchased = await caller.household.purchase({ id: item.id });
    expect(purchased.status).toBe('stocked');
    expect(purchased.lastPurchased).not.toBeNull();
    expect(purchased.lastPurchasedBy).toBe(world.alex.id);
  });

  it('list resolves addedByUser and lastPurchasedByUser', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const item = await alex.household.add(
      createHouseholdInput({ workspaceId: world.workspace.id, name: 'Coffee', status: 'out' }),
    );

    const beforePurchase = await alex.household.list({ workspaceId: world.workspace.id });
    const beforeItem = beforePurchase.find((i) => i.id === item.id);
    expect(beforeItem?.addedByUser).toMatchObject({ id: world.alex.id });
    expect(beforeItem?.lastPurchasedByUser).toBeNull();

    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    await jordan.household.purchase({ id: item.id });

    const afterPurchase = await alex.household.list({ workspaceId: world.workspace.id });
    const afterItem = afterPurchase.find((i) => i.id === item.id);
    expect(afterItem?.addedByUser).toMatchObject({ id: world.alex.id });
    expect(afterItem?.lastPurchasedByUser).toMatchObject({ id: world.jordan.id });
  });

  it('restock flags an item as out (back on the shopping list)', async () => {
    const caller = callerFor(ctx.db, world.alex.clerkId);
    const item = await caller.household.add(
      createHouseholdInput({ workspaceId: world.workspace.id, name: 'Flour', status: 'stocked' }),
    );

    const restocked = await caller.household.restock({ id: item.id });
    expect(restocked.status).toBe('out');
  });

  it('update edits fields and is visible to the partner (shared workspace)', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const item = await alex.household.add(
      createHouseholdInput({ workspaceId: world.workspace.id, name: 'Pasta' }),
    );

    const updated = await alex.household.update({
      id: item.id,
      name: 'Pasta (penne)',
      quantity: 3,
      unit: 'boxes',
      status: 'low',
    });
    expect(updated).toMatchObject({ name: 'Pasta (penne)', quantity: 3, unit: 'boxes', status: 'low' });

    // Household items are workspace-shared: the partner sees the edit.
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const jordanList = await jordan.household.list({ workspaceId: world.workspace.id });
    expect(jordanList.find((i) => i.id === item.id)).toMatchObject({ name: 'Pasta (penne)' });
  });

  it('the partner can purchase an item the other added', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const item = await alex.household.add(
      createHouseholdInput({ workspaceId: world.workspace.id, name: 'Butter', status: 'out' }),
    );

    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const purchased = await jordan.household.purchase({ id: item.id });
    expect(purchased.status).toBe('stocked');
  });
});

describe('householdRouter — item privacy', () => {
  it('hides a private item from other members and blocks their edits', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const secret = await alex.household.add({
      workspaceId: world.workspace.id,
      name: 'Surprise gift',
      visibility: 'private',
    });
    await alex.household.add({ workspaceId: world.workspace.id, name: 'Milk' });

    const jordanList = await jordan.household.list({ workspaceId: world.workspace.id });
    expect(jordanList.map((i) => i.name)).toContain('Milk');
    expect(jordanList.map((i) => i.name)).not.toContain('Surprise gift');

    const alexList = await alex.household.list({ workspaceId: world.workspace.id });
    expect(alexList.map((i) => i.name)).toEqual(expect.arrayContaining(['Milk', 'Surprise gift']));

    await expect(
      jordan.household.update({ id: secret.id, name: 'peek' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
