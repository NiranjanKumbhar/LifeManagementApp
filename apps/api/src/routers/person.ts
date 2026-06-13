import { router, unwrap } from '../trpc';
import { protectedProcedure } from '../middleware/auth';
import { workspaceProcedure } from '../middleware/workspace';
import { PersonService } from '../services/person.service';
import {
  createPersonSchema,
  listPeopleSchema,
  personIdSchema,
  updatePersonSchema,
} from '../utils/validation';

export const personRouter = router({
  list: workspaceProcedure.input(listPeopleSchema).query(async ({ ctx, input }) => {
    return unwrap(await PersonService.list(ctx.db, input.workspaceId));
  }),

  get: protectedProcedure.input(personIdSchema).query(async ({ ctx, input }) => {
    return unwrap(await PersonService.get(ctx.db, ctx.userId, input.id));
  }),

  create: workspaceProcedure.input(createPersonSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await PersonService.create(ctx.db, ctx.userId, input));
  }),

  update: protectedProcedure.input(updatePersonSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await PersonService.update(ctx.db, ctx.userId, input));
  }),

  delete: protectedProcedure.input(personIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await PersonService.delete(ctx.db, ctx.userId, input.id));
  }),
});
