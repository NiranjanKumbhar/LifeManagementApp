import { faker } from '@faker-js/faker';
import type { Database } from '../../db/client';
import { inboxItems } from '../../db/schema';

type InboxInsert = typeof inboxItems.$inferInsert;
type InboxRow = typeof inboxItems.$inferSelect;

export async function insertInboxItem(
  db: Database,
  overrides: Partial<InboxInsert> & { workspaceId: string; capturedBy: string },
): Promise<InboxRow> {
  const [row] = await db
    .insert(inboxItems)
    .values({ content: faker.lorem.sentence(5), ...overrides })
    .returning();
  return row as InboxRow;
}
