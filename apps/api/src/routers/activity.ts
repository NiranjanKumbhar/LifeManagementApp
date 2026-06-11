import { router, unwrap } from '../trpc';
import { workspaceProcedure } from '../middleware/workspace';
import { ActivityService } from '../services/activity.service';
import { activityFeedSchema } from '../utils/validation';

export const activityRouter = router({
  feed: workspaceProcedure.input(activityFeedSchema).query(async ({ ctx, input }) => {
    return unwrap(await ActivityService.feed(ctx.db, ctx.userId, input));
  }),
});
