import { faker } from '@faker-js/faker';
import type { Database } from '../../db/client';
import { workspaces } from '../../db/schema';

type WorkspaceInsert = typeof workspaces.$inferInsert;
type WorkspaceRow = typeof workspaces.$inferSelect;

export async function insertWorkspace(
  db: Database,
  overrides: Partial<WorkspaceInsert> = {},
): Promise<WorkspaceRow> {
  const [row] = await db
    .insert(workspaces)
    .values({ name: `${faker.company.name()} Household`, ...overrides })
    .returning();
  return row as WorkspaceRow;
}
