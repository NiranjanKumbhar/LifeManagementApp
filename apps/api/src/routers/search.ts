import { router, unwrap } from '../trpc';
import { workspaceProcedure } from '../middleware/workspace';
import { SearchService } from '../services/search.service';
import { searchSchema } from '../utils/validation';

export const searchRouter = router({
  query: workspaceProcedure.input(searchSchema).query(async ({ ctx, input }) => {
    return unwrap(await SearchService.query(ctx.db, ctx.userId, input));
  }),
});
