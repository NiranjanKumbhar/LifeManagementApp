import { and, desc, eq, lt } from 'drizzle-orm';
import type { z } from 'zod';
import type { Database } from '../db/client';
import { activityEvents, projects } from '../db/schema';
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
   * Events for private projects are hidden from members other than the owner.
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
      })
      .from(activityEvents)
      // Join the referenced project (only for project-entity events) to apply
      // visibility. Non-project events have null join columns and pass through.
      .leftJoin(
        projects,
        and(eq(activityEvents.entityType, 'project'), eq(activityEvents.entityId, projects.id)),
      )
      .where(
        and(
          eq(activityEvents.workspaceId, input.workspaceId),
          input.cursor ? lt(activityEvents.createdAt, new Date(input.cursor)) : undefined,
        ),
      )
      .orderBy(desc(activityEvents.createdAt))
      .limit(limit + 1);

    const visible = rows
      .filter((r) => !(r.projectVisibility === 'private' && r.projectOwner !== userId))
      .map((r) => r.event);

    const hasMore = visible.length > limit;
    const items = hasMore ? visible.slice(0, limit) : visible;
    const last = items[items.length - 1];
    const nextCursor = hasMore && last ? last.createdAt.toISOString() : null;

    return ok({ items, nextCursor, hasMore });
  }
}
