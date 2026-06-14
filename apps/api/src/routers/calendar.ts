import { router, unwrap } from '../trpc';
import { workspaceProcedure } from '../middleware/workspace';
import { CalendarService } from '../services/calendar.service';
import { calendarRangeSchema } from '../utils/validation';

export const calendarRouter = router({
  list: workspaceProcedure.input(calendarRangeSchema).query(async ({ ctx, input }) => {
    return unwrap(await CalendarService.list(ctx.db, ctx.userId, input));
  }),
});
