import { faker } from '@faker-js/faker';
import type { Database } from '../../db/client';
import { tasks } from '../../db/schema';

type TaskInsert = typeof tasks.$inferInsert;
type TaskRow = typeof tasks.$inferSelect;

export async function insertTask(
  db: Database,
  overrides: Partial<TaskInsert> & { projectId: string },
): Promise<TaskRow> {
  const [row] = await db
    .insert(tasks)
    .values({
      title: faker.lorem.sentence(3),
      path: '',
      ...overrides,
    })
    .returning();
  return row as TaskRow;
}
