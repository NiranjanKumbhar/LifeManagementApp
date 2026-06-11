import { router, unwrap } from '../trpc';
import { protectedProcedure } from '../middleware/auth';
import { ResourceService } from '../services/resource.service';
import { listResourcesSchema, resourceIdSchema, uploadResourceSchema } from '../utils/validation';

export const resourceRouter = router({
  list: protectedProcedure.input(listResourcesSchema).query(async ({ ctx, input }) => {
    return unwrap(await ResourceService.list(ctx.db, ctx.userId, input));
  }),

  upload: protectedProcedure.input(uploadResourceSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await ResourceService.upload(ctx.db, ctx.userId, input));
  }),

  delete: protectedProcedure.input(resourceIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await ResourceService.delete(ctx.db, ctx.userId, input.id));
  }),
});
