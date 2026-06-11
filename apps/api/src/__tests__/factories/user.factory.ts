import { faker } from '@faker-js/faker';
import type { Database } from '../../db/client';
import { users, workspaceMembers } from '../../db/schema';

type UserInsert = typeof users.$inferInsert;
type UserRow = typeof users.$inferSelect;
type MemberRow = typeof workspaceMembers.$inferSelect;

export async function insertUser(
  db: Database,
  overrides: Partial<UserInsert> = {},
): Promise<UserRow> {
  const [row] = await db
    .insert(users)
    .values({
      clerkId: `clerk_${faker.string.alphanumeric(16)}`,
      email: faker.internet.email().toLowerCase(),
      displayName: faker.person.firstName(),
      ...overrides,
    })
    .returning();
  return row as UserRow;
}

export async function addMember(
  db: Database,
  workspaceId: string,
  userId: string,
  role: 'owner' | 'member' = 'member',
): Promise<MemberRow> {
  const [row] = await db
    .insert(workspaceMembers)
    .values({ workspaceId, userId, role, joinedAt: new Date() })
    .returning();
  return row as MemberRow;
}
