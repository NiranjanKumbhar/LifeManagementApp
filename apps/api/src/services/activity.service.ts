import { and, desc, eq, lt } from 'drizzle-orm';
import type { z } from 'zod';
import type { Database } from '../db/client';
import { activityEvents, householdItems, projects, tasks } from '../db/schema';
import { ok, type AppError, type Result } from '../utils/errors';
import type { activityFeedSchema } from '../utils/validation';

type ActivityRow = typeof activityEvents.$inferSelect;
type FeedInput = z.infer<typeof activityFeedSchema>;

export interface ActivityFeedPage {
  items: ActivityRow[];
  nextCursor: string | null;
  hasMore: boolean;
}

const DEFAULT_LIMIT = 20;

export class ActivityService {
  /**
   * Paginated workspace activity feed (cursor = ISO timestamp of the last item).
   * Events for private items (projects, tasks, household items) are hidden from
   * members other than the item's owner.
   */
  static async feed(
    db: Database,
    userId: string,
    input: FeedInput,
  ): Promise<Result<ActivityFeedPage, AppError>> {
    const limit = input.limit ?? DEFAULT_LIMIT;

    const rows = await db
      .select({
        event: activityEvents,
        projectVisibility: projects.visibility,
        projectOwner: projects.ownerId,
        taskVisibility: tasks.visibility,
        taskOwner: tasks.createdBy,
        itemVisibility: householdItems.visibility,
        itemOwner: householdItems.addedBy,
      })
      .from(activityEvents)
      // Join the referenced entity per type to apply visibility. An event matches
      // at most one join (others stay null and pass through the filter).
      .leftJoin(
        projects,
        and(eq(activityEvents.entityType, 'project'), eq(activityEvents.entityId, projects.id)),
      )
      .leftJoin(
        tasks,
        and(eq(activityEvents.entityType, 'task'), eq(activityEvents.entityId, tasks.id)),
      )
      .leftJoin(
        householdItems,
        and(
          eq(activityEvents.entityType, 'household_item'),
          eq(activityEvents.entityId, householdItems.id),
        ),
      )
      .where(
        and(
          eq(activityEvents.workspaceId, input.workspaceId),
          input.cursor ? lt(activityEvents.createdAt, new Date(input.cursor)) : undefined,
        ),
      )
      .orderBy(desc(activityEvents.createdAt))
      .limit(limit + 1);

    // Hide events whose referenced item is private and not owned by the viewer.
    const hidden = (
      visibility: string | null,
      owner: string | null,
    ): boolean => visibility === 'private' && owner !== userId;

    const visible = rows
      .filter(
        (r) =>
          !hidden(r.projectVisibility, r.projectOwner) &&
          !hidden(r.taskVisibility, r.taskOwner) &&
          !hidden(r.itemVisibility, r.itemOwner),
      )
      .map((r) => r.event);

    const hasMore = visible.length > limit;
    const items = hasMore ? visible.slice(0, limit) : visible;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;

    return ok({ items, nextCursor, hasMore });
  }
}
