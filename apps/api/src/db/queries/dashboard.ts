import { and, eq, gte, isNull, lt, lte, ne, or } from 'drizzle-orm';
import { db } from '../client';
import { projects, tasks, reminders, householdItems, activityEvents } from '../schema';

export async function getDashboardData(workspaceId: string, userId: string) {
  const today = new Date().toISOString().split('T')[0]!;
  const in14Days = new Date();
  in14Days.setDate(in14Days.getDate() + 14);
  const in14DaysStr = in14Days.toISOString().split('T')[0]!;

  const [urgentProjects, overdueProjects, upcomingTasks, pendingHousehold, recentActivity] =
    await Promise.all([
      // Projects due within 14 days, not completed
      db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.workspaceId, workspaceId),
            ne(projects.status, 'completed'),
            ne(projects.status, 'archived'),
            lte(projects.dueDate, in14DaysStr),
            or(eq(projects.visibility, 'shared'), eq(projects.ownerId, userId)),
          ),
        )
        .limit(10),

      // Overdue projects
      db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.workspaceId, workspaceId),
            ne(projects.status, 'completed'),
            ne(projects.status, 'archived'),
            lt(projects.dueDate, today),
            or(eq(projects.visibility, 'shared'), eq(projects.ownerId, userId)),
          ),
        )
        .limit(10),

      // Tasks due in next 7 days assigned to or owned by this user
      db
        .select({ task: tasks, project: projects })
        .from(tasks)
        .innerJoin(projects, eq(tasks.projectId, projects.id))
        .where(
          and(
            eq(projects.workspaceId, workspaceId),
            ne(tasks.status, 'completed'),
            ne(tasks.status, 'cancelled'),
            lte(tasks.dueDate, in14DaysStr),
            gte(tasks.dueDate, today),
            eq(tasks.ownerId, userId),
          ),
        )
        .limit(20),

      // Household items that are low, out, or on the list
      db
        .select()
        .from(householdItems)
        .where(
          and(
            eq(householdItems.workspaceId, workspaceId),
            or(
              eq(householdItems.status, 'low'),
              eq(householdItems.status, 'out'),
              eq(householdItems.status, 'on_list'),
            ),
          ),
        )
        .limit(20),

      // Recent activity in workspace (last 20 events)
      db
        .select()
        .from(activityEvents)
        .where(eq(activityEvents.workspaceId, workspaceId))
        .orderBy()
        .limit(20),
    ]);

  return { urgentProjects, overdueProjects, upcomingTasks, pendingHousehold, recentActivity };
}

export async function getPendingReminderCount(userId: string): Promise<number> {
  const pending = await db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.userId, userId),
        eq(reminders.isSent, false),
        lte(reminders.remindAt, new Date()),
        isNull(reminders.snoozedUntil),
      ),
    );
  return pending.length;
}
