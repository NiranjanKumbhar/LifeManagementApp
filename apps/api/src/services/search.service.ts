import { and, eq, ilike, or } from 'drizzle-orm';
import type { z } from 'zod';
import type { Database } from '../db/client';
import { householdItems, people, projects, tasks } from '../db/schema';
import { ok, type AppError, type Result } from '../utils/errors';
import { projectVisibilityCondition } from './authz';
import type { searchSchema } from '../utils/validation';

type SearchInput = z.infer<typeof searchSchema>;
type ProjectRow = typeof projects.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;
type PersonRow = typeof people.$inferSelect;
type HouseholdRow = typeof householdItems.$inferSelect;

export type SearchResultType = 'project' | 'task' | 'person' | 'household_item';

export interface SearchResultOut {
  type: SearchResultType;
  item: ProjectRow | TaskRow | PersonRow | HouseholdRow;
  highlights: string[];
}

const LIMIT_PER_TYPE = 20;

export class SearchService {
  /** Full-text-ish search (ILIKE) across the workspace, visibility-filtered. */
  static async query(
    db: Database,
    userId: string,
    input: SearchInput,
  ): Promise<Result<SearchResultOut[], AppError>> {
    const pattern = `%${input.query}%`;
    const want = (t: SearchResultType): boolean => !input.type || input.type === t;
    const results: SearchResultOut[] = [];

    if (want('project')) {
      const rows = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.workspaceId, input.workspaceId),
            projectVisibilityCondition(userId),
            or(ilike(projects.title, pattern), ilike(projects.description, pattern)),
          ),
        )
        .limit(LIMIT_PER_TYPE);
      for (const item of rows) results.push({ type: 'project', item, highlights: [item.title] });
    }

    if (want('task')) {
      const rows = await db
        .select({ task: tasks })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(projects.workspaceId, input.workspaceId),
            projectVisibilityCondition(userId),
            or(ilike(tasks.title, pattern), ilike(tasks.description, pattern)),
          ),
        )
        .limit(LIMIT_PER_TYPE);
      for (const r of rows) results.push({ type: 'task', item: r.task, highlights: [r.task.title] });
    }

    if (want('person')) {
      const rows = await db
        .select()
        .from(people)
        .where(
          and(
            eq(people.workspaceId, input.workspaceId),
            or(ilike(people.name, pattern), ilike(people.notes, pattern)),
          ),
        )
        .limit(LIMIT_PER_TYPE);
      for (const item of rows) results.push({ type: 'person', item, highlights: [item.name] });
    }

    if (want('household_item')) {
      const rows = await db
        .select()
        .from(householdItems)
        .where(
          and(
            eq(householdItems.workspaceId, input.workspaceId),
            ilike(householdItems.name, pattern),
          ),
        )
        .limit(LIMIT_PER_TYPE);
      for (const item of rows)
        results.push({ type: 'household_item', item, highlights: [item.name] });
    }

    return ok(results);
  }
}
