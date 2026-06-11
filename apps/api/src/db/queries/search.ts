import { and, eq, ilike, ne, or } from 'drizzle-orm';
import { db } from '../client';
import { projects, tasks, people, householdItems } from '../schema';

export interface SearchOptions {
  workspaceId: string;
  userId: string;
  query: string;
  limit?: number;
}

export interface SearchResults {
  projects: (typeof projects.$inferSelect)[];
  tasks: (typeof tasks.$inferSelect)[];
  people: (typeof people.$inferSelect)[];
  householdItems: (typeof householdItems.$inferSelect)[];
}

// Visibility filter: show shared items or items owned by this user.
// Private items are NEVER returned for anyone other than their owner.
function visibilityFilter(userId: string) {
  return or(eq(projects.visibility, 'shared'), eq(projects.ownerId, userId));
}

export async function search(options: SearchOptions): Promise<SearchResults> {
  const { workspaceId, userId, query, limit = 20 } = options;
  const pattern = `%${query}%`;

  const [matchedProjects, matchedTasks, matchedPeople, matchedItems] = await Promise.all([
    db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          ne(projects.status, 'archived'),
          or(ilike(projects.title, pattern), ilike(projects.description, pattern)),
          visibilityFilter(userId),
        ),
      )
      .limit(limit),

    db
      .select()
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          ne(tasks.status, 'cancelled'),
          or(ilike(tasks.title, pattern), ilike(tasks.description, pattern)),
          visibilityFilter(userId),
        ),
      )
      .limit(limit)
      .then((rows) => rows.map((r) => r.tasks)),

    db
      .select()
      .from(people)
      .where(
        and(
          eq(people.workspaceId, workspaceId),
          or(ilike(people.name, pattern), ilike(people.notes, pattern)),
        ),
      )
      .limit(limit),

    db
      .select()
      .from(householdItems)
      .where(
        and(
          eq(householdItems.workspaceId, workspaceId),
          ilike(householdItems.name, pattern),
        ),
      )
      .limit(limit),
  ]);

  return {
    projects: matchedProjects,
    tasks: matchedTasks,
    people: matchedPeople,
    householdItems: matchedItems,
  };
}
