import { faker } from '@faker-js/faker';
import type { CreateProjectInput, ProjectType } from '@lifesync/shared-types';
import type { Database } from '../../db/client';
import { projects } from '../../db/schema';

type ProjectInsert = typeof projects.$inferInsert;
type ProjectRow = typeof projects.$inferSelect;

const PROJECT_TYPES: ProjectType[] = [
  'occasion',
  'compliance',
  'household',
  'health',
  'travel',
  'planning',
];

/** Pure input factory for `ProjectService.create` (mirrors a Zod-validated input). */
export function createProjectInput(
  overrides: Partial<CreateProjectInput> = {},
): CreateProjectInput {
  return {
    workspaceId: faker.string.uuid(),
    type: faker.helpers.arrayElement(PROJECT_TYPES),
    title: faker.lorem.sentence(3),
    visibility: 'shared',
    ...overrides,
  };
}

/** Insert a project row directly (bypassing service logic) for arranging state. */
export async function insertProject(
  db: Database,
  overrides: Partial<ProjectInsert> & { workspaceId: string },
): Promise<ProjectRow> {
  const [row] = await db
    .insert(projects)
    .values({
      type: 'household',
      title: faker.lorem.sentence(3),
      ...overrides,
    })
    .returning();
  return row as ProjectRow;
}
