import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { tasks } from '../db/schema';
import { inngest } from './inngest';

type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface RecurrenceRule {
  frequency: Frequency;
  interval: number;
}

function parseRecurrenceRule(rule: Record<string, unknown> | null): RecurrenceRule | null {
  if (!rule) return null;
  const frequency = rule['frequency'];
  if (
    frequency !== 'daily' &&
    frequency !== 'weekly' &&
    frequency !== 'monthly' &&
    frequency !== 'yearly'
  ) {
    return null;
  }
  const rawInterval = rule['interval'];
  const interval =
    typeof rawInterval === 'number' && Number.isFinite(rawInterval) && rawInterval > 0
      ? Math.floor(rawInterval)
      : 1;
  return { frequency, interval };
}

/** Format a Date as a YYYY-MM-DD string (the `date` column type). */
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeNextDate(base: Date, rule: RecurrenceRule): Date {
  const next = new Date(base.getTime());
  switch (rule.frequency) {
    case 'daily':
      next.setUTCDate(next.getUTCDate() + rule.interval);
      break;
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7 * rule.interval);
      break;
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + rule.interval);
      break;
    case 'yearly':
      next.setUTCFullYear(next.getUTCFullYear() + rule.interval);
      break;
  }
  return next;
}

/**
 * Cron job: runs daily at 1 AM UTC. Finds recurring tasks that were completed in
 * the last 25 hours and spawns the next occurrence (a fresh pending task) with
 * the next computed due date.
 */
export const spawnRecurringTasks = inngest.createFunction(
  { id: 'spawn-recurring-tasks', name: 'Spawn Recurring Tasks' },
  { cron: '0 1 * * *' },
  async ({ step, logger }) => {
    const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000);

    const completed = await step.run('find-completed-recurring', () =>
      db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.isRecurring, true),
            eq(tasks.status, 'completed'),
            gte(tasks.completedAt, cutoff),
          ),
        )
        .limit(500),
    );

    if (completed.length === 0) {
      return { spawned: 0 };
    }

    logger.info(`Found ${completed.length} completed recurring task(s)`);

    let spawned = 0;
    for (const task of completed) {
      const created = await step.run(`spawn-${task.id}`, async () => {
        const rule = parseRecurrenceRule(task.recurrenceRule ?? null);
        if (!rule) {
          logger.warn(`Skipping task ${task.id}: invalid recurrence rule`);
          return false;
        }

        const base = task.dueDate
          ? new Date(`${task.dueDate}T00:00:00.000Z`)
          : task.completedAt
            ? new Date(task.completedAt)
            : null;
        if (!base || Number.isNaN(base.getTime())) {
          logger.warn(`Skipping task ${task.id}: no valid base date`);
          return false;
        }

        const nextDue = computeNextDate(base, rule);

        await db.insert(tasks).values({
          projectId: task.projectId,
          title: task.title,
          description: task.description,
          status: 'pending',
          priority: task.priority,
          ownerId: task.ownerId,
          dueDate: toDateString(nextDue),
          visibility: task.visibility,
          isRecurring: true,
          recurrenceRule: task.recurrenceRule,
          createdBy: task.createdBy,
        });

        return true;
      });

      if (created) spawned++;
    }

    return { spawned };
  },
);
