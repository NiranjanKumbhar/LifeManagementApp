import { and, eq, gte, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { notifications, projects, tasks, workspaceMembers } from '../db/schema';
import { inngest } from './inngest';

const ESCALATION_WINDOWS = [1, 3, 7] as const;

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function windowForDate(dueDate: string, today: Date): number | null {
  for (const days of ESCALATION_WINDOWS) {
    const target = new Date(today);
    target.setUTCDate(target.getUTCDate() + days);
    if (toDateString(target) === dueDate) return days;
  }
  return null;
}

async function alreadyNotifiedToday(
  entityId: string,
  title: string,
  midnight: Date,
): Promise<boolean> {
  const existing = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.entityId, entityId),
        eq(notifications.type, 'system'),
        eq(notifications.title, title),
        gte(notifications.createdAt, midnight),
      ),
    )
    .limit(1);
  return existing.length > 0;
}

/**
 * Daily cron (07:00 UTC): surfaces projects and tasks whose deadline lands
 * exactly 1, 3, or 7 days out as in-app urgency notifications.
 */
export const escalateDeadlines = inngest.createFunction(
  { id: 'escalate-deadlines', name: 'Escalate Approaching Deadlines' },
  { cron: '0 7 * * *' },
  async ({ step, logger }) => {
    const today = new Date();
    const midnight = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const targetDates = ESCALATION_WINDOWS.map((days) => {
      const target = new Date(today);
      target.setUTCDate(target.getUTCDate() + days);
      return toDateString(target);
    });

    const projectNotifications = await step.run('escalate-projects', async () => {
      const dueProjects = await db
        .select({
          id: projects.id,
          title: projects.title,
          workspaceId: projects.workspaceId,
          dueDate: projects.dueDate,
        })
        .from(projects)
        .where(and(eq(projects.status, 'active'), inArray(projects.dueDate, targetDates)));

      let created = 0;
      for (const project of dueProjects) {
        if (!project.dueDate) continue;
        const days = windowForDate(project.dueDate, today);
        if (days === null) continue;

        const title = `⚠️ Project due in ${days} day${days === 1 ? '' : 's'}: ${project.title}`;
        if (await alreadyNotifiedToday(project.id, title, midnight)) continue;

        const members = await db
          .select({ userId: workspaceMembers.userId })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.workspaceId, project.workspaceId));

        if (members.length === 0) continue;

        await db.insert(notifications).values(
          members.map((member) => ({
            userId: member.userId,
            workspaceId: project.workspaceId,
            type: 'system' as const,
            title,
            body: null,
            entityType: 'project',
            entityId: project.id,
          })),
        );
        created += members.length;
      }
      return created;
    });

    const taskNotifications = await step.run('escalate-tasks', async () => {
      const dueTasks = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          ownerId: tasks.ownerId,
          dueDate: tasks.dueDate,
          workspaceId: projects.workspaceId,
        })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            inArray(tasks.status, ['pending', 'in_progress']),
            inArray(tasks.dueDate, targetDates),
          ),
        );

      let created = 0;
      for (const task of dueTasks) {
        if (!task.dueDate || !task.ownerId) continue;
        const days = windowForDate(task.dueDate, today);
        if (days === null) continue;

        const title = `📅 Task due in ${days} day${days === 1 ? '' : 's'}: ${task.title}`;
        if (await alreadyNotifiedToday(task.id, title, midnight)) continue;

        await db.insert(notifications).values({
          userId: task.ownerId,
          workspaceId: task.workspaceId,
          type: 'system',
          title,
          body: null,
          entityType: 'task',
          entityId: task.id,
        });
        created += 1;
      }
      return created;
    });

    logger.info(
      `Escalation: ${projectNotifications} project + ${taskNotifications} task notification(s)`,
    );

    return { projectNotifications, taskNotifications };
  },
);
