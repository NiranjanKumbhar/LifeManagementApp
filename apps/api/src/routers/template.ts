import { router, unwrap } from '../trpc';
import { protectedProcedure } from '../middleware/auth';
import { workspaceProcedure } from '../middleware/workspace';
import { TemplateService } from '../services/template.service';
import {
  createTemplateSchema,
  listTemplatesSchema,
  templateIdSchema,
  updateTemplateSchema,
} from '../utils/validation';

export const templateRouter = router({
  list: workspaceProcedure.input(listTemplatesSchema).query(async ({ ctx, input }) => {
    return unwrap(await TemplateService.list(ctx.db, input));
  }),

  get: protectedProcedure.input(templateIdSchema).query(async ({ ctx, input }) => {
    return unwrap(await TemplateService.get(ctx.db, ctx.userId, input.id));
  }),

  create: workspaceProcedure.input(createTemplateSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await TemplateService.create(ctx.db, input));
  }),

  update: protectedProcedure.input(updateTemplateSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await TemplateService.update(ctx.db, ctx.userId, input));
  }),

  delete: protectedProcedure.input(templateIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await TemplateService.delete(ctx.db, ctx.userId, input.id));
  }),
});
