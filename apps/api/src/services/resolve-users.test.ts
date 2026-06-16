import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveUsers } from './resolve-users';
import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { insertUser } from '../__tests__/factories/user.factory';

let ctx: TestDb;

beforeEach(async () => {
  ctx = await createTestDb();
});

afterEach(async () => {
  await ctx.close();
});

describe('resolveUsers', () => {
  it('maps user ids to UserRefs, deduplicates, and ignores nulls/undefineds', async () => {
    const a = await insertUser(ctx.db, { displayName: 'Alice', avatarUrl: 'https://example.com/alice.png' });
    const b = await insertUser(ctx.db, { displayName: 'Bob', avatarUrl: null });

    const map = await resolveUsers(ctx.db, [a.id, null, a.id, b.id, undefined]);

    expect(map.size).toBe(2);
    expect(map.get(a.id)?.displayName).toBe(a.displayName);
    expect(map.get(b.id)?.avatarUrl).toBe(b.avatarUrl);
  });

  it('returns an empty map when given only nulls and undefineds', async () => {
    const map = await resolveUsers(ctx.db, [null, undefined]);

    expect(map.size).toBe(0);
  });
});
