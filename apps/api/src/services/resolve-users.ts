import { inArray } from 'drizzle-orm';
import type { Database } from '../db/client';
import { users } from '../db/schema';
import type { UserRef } from '@lifesync/shared-types';

/** Map a (possibly null/duplicated) set of user ids to UserRefs. Nulls are ignored. */
export async function resolveUsers(
  db: Database,
  ids: Array<string | null | undefined>,
): Promise<Map<string, UserRef>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, unique));
  return new Map(rows.map((r) => [r.id, r]));
}
