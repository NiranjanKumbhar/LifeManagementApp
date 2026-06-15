import { faker } from '@faker-js/faker';
import type { z } from 'zod';
import type { Database } from '../../db/client';
import { householdItems } from '../../db/schema';
import type { createHouseholdSchema } from '../../utils/validation';

type ItemInsert = typeof householdItems.$inferInsert;
type ItemRow = typeof householdItems.$inferSelect;
type CreateInput = z.infer<typeof createHouseholdSchema>;

/** Pure input factory for `HouseholdService.add` (mirrors a Zod-validated input). */
export function createHouseholdInput(
  overrides: Partial<CreateInput> & { workspaceId: string },
): CreateInput {
  return {
    name: faker.commerce.product(),
    category: 'pantry',
    status: 'stocked',
    ...overrides,
  };
}

/** Insert a household item row directly (bypassing service logic) for arranging state. */
export async function insertHouseholdItem(
  db: Database,
  overrides: Partial<ItemInsert> & { workspaceId: string; addedBy: string },
): Promise<ItemRow> {
  const [row] = await db
    .insert(householdItems)
    .values({
      name: faker.commerce.product(),
      category: 'pantry',
      status: 'stocked',
      ...overrides,
    })
    .returning();
  return row as ItemRow;
}
