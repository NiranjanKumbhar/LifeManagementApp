import { router, unwrap } from '../trpc';
import { protectedProcedure } from '../middleware/auth';
import { workspaceProcedure } from '../middleware/workspace';
import { HouseholdService } from '../services/household.service';
import {
  createHouseholdSchema,
  householdIdSchema,
  listHouseholdSchema,
  updateHouseholdSchema,
} from '../utils/validation';

export const householdRouter = router({
  list: workspaceProcedure.input(listHouseholdSchema).query(async ({ ctx, input }) => {
    return unwrap(await HouseholdService.list(ctx.db, ctx.userId, input));
  }),

  add: workspaceProcedure.input(createHouseholdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await HouseholdService.add(ctx.db, ctx.userId, input));
  }),

  update: protectedProcedure.input(updateHouseholdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await HouseholdService.update(ctx.db, ctx.userId, input));
  }),

  purchase: protectedProcedure.input(householdIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await HouseholdService.purchase(ctx.db, ctx.userId, input.id));
  }),

  restock: protectedProcedure.input(householdIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await HouseholdService.restock(ctx.db, ctx.userId, input.id));
  }),
});
