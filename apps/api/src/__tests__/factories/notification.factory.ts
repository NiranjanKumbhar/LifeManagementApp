import { faker } from '@faker-js/faker';
import type { Database } from '../../db/client';
import { notifications } from '../../db/schema';

type NotificationInsert = typeof notifications.$inferInsert;
type NotificationRow = typeof notifications.$inferSelect;

/**
 * Insert a notification row directly. Nothing in the app creates notifications
 * yet (Inngest jobs are unbuilt), so tests arrange them by hand.
 */
export async function insertNotification(
  db: Database,
  overrides: Partial<NotificationInsert> & { userId: string; workspaceId: string },
): Promise<NotificationRow> {
  const [row] = await db
    .insert(notifications)
    .values({
      type: 'reminder',
      title: faker.lorem.sentence(4),
      ...overrides,
    })
    .returning();
  return row as NotificationRow;
}
