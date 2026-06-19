import { and, eq, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { notifications, reminders } from '../db/schema';
import { inngest } from './inngest';

const DAY_MS = 24 * 60 * 60 * 1000;

export const weeklyCleanup = inngest.createFunction(
  { id: 'weekly-cleanup', name: 'Weekly Cleanup' },
  { cron: '0 3 * * 0' },
  async ({ step }) => {
    const now = Date.now();

    const deletedReminders = await step.run('prune-sent-reminders', async () => {
      const cutoff = new Date(now - 30 * DAY_MS);
      const deleted = await db
        .delete(reminders)
        .where(and(eq(reminders.isSent, true), lt(reminders.sentAt, cutoff)))
        .returning({ id: reminders.id });
      return deleted.length;
    });

    const deletedNotifications = await step.run('prune-read-notifications', async () => {
      const cutoff = new Date(now - 60 * DAY_MS);
      const deleted = await db
        .delete(notifications)
        .where(and(eq(notifications.isRead, true), lt(notifications.readAt, cutoff)))
        .returning({ id: notifications.id });
      return deleted.length;
    });

    return { deletedReminders, deletedNotifications };
  },
);
