import { router, unwrap } from '../trpc';
import { protectedProcedure } from '../middleware/auth';
import { ReminderService } from '../services/reminder.service';
import {
  createReminderSchema,
  listRemindersSchema,
  reminderIdSchema,
  snoozeReminderSchema,
} from '../utils/validation';

/** Reminders are personal: every procedure operates on the current user's own. */
export const reminderRouter = router({
  list: protectedProcedure.input(listRemindersSchema).query(async ({ ctx, input }) => {
    return unwrap(await ReminderService.list(ctx.db, ctx.userId, input.includeSent ?? false));
  }),

  create: protectedProcedure.input(createReminderSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await ReminderService.create(ctx.db, ctx.userId, input));
  }),

  snooze: protectedProcedure.input(snoozeReminderSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await ReminderService.snooze(ctx.db, ctx.userId, input.id, input.snoozeUntil));
  }),

  dismiss: protectedProcedure.input(reminderIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await ReminderService.dismiss(ctx.db, ctx.userId, input.id));
  }),
});
