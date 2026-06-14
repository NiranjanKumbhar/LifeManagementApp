import { and, eq, gte, isNotNull, lt, lte, ne } from 'drizzle-orm';
import type { z } from 'zod';
import type { CalendarItem } from '@lifesync/shared-types';
import type { Database } from '../db/client';
import { people, projects, reminders, tasks } from '../db/schema';
import { ok, type AppError, type Result } from '../utils/errors';
import { projectVisibilityCondition } from './authz';
import { occurrenceInRange } from '../utils/calendar-dates';
import { toISODateString } from '../utils/dates';
import type { calendarRangeSchema } from '../utils/validation';

type RangeInput = z.infer<typeof calendarRangeSchema>;

export class CalendarService {
  static async list(
    db: Database,
    userId: string,
    input: RangeInput,
  ): Promise<Result<CalendarItem[], AppError>> {
    const { workspaceId, from, to } = input;
    const items: CalendarItem[] = [];

    const projectRows = await db
      .select({ id: projects.id, title: projects.title, dueDate: projects.dueDate })
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          ne(projects.status, 'archived'),
          isNotNull(projects.dueDate),
          gte(projects.dueDate, from),
          lte(projects.dueDate, to),
          projectVisibilityCondition(userId),
        ),
      );
    for (const p of projectRows) {
      items.push({ id: p.id, date: p.dueDate as string, kind: 'project_due', title: p.title, projectId: p.id, personId: null });
    }

    const taskRows = await db
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, projectId: tasks.projectId })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          ne(tasks.status, 'cancelled'),
          isNotNull(tasks.dueDate),
          gte(tasks.dueDate, from),
          lte(tasks.dueDate, to),
          projectVisibilityCondition(userId),
        ),
      );
    for (const t of taskRows) {
      items.push({ id: t.id, date: t.dueDate as string, kind: 'task_due', title: t.title, projectId: t.projectId, personId: null });
    }

    const peopleRows = await db
      .select({ id: people.id, name: people.name, birthday: people.birthday, anniversary: people.anniversary })
      .from(people)
      .where(eq(people.workspaceId, workspaceId));
    for (const person of peopleRows) {
      const bd = person.birthday ? occurrenceInRange(person.birthday, from, to) : null;
      if (bd) items.push({ id: `${person.id}:birthday`, date: bd, kind: 'birthday', title: person.name, projectId: null, personId: person.id });
      const an = person.anniversary ? occurrenceInRange(person.anniversary, from, to) : null;
      if (an) items.push({ id: `${person.id}:anniversary`, date: an, kind: 'anniversary', title: person.name, projectId: null, personId: person.id });
    }

    const fromDate = new Date(`${from}T00:00:00`);
    const toExclusive = new Date(`${to}T00:00:00`);
    toExclusive.setDate(toExclusive.getDate() + 1);
    const reminderRows = await db
      .select({ id: reminders.id, message: reminders.message, remindAt: reminders.remindAt, projectId: reminders.projectId })
      .from(reminders)
      .where(
        and(
          eq(reminders.userId, userId),
          eq(reminders.isSent, false),
          gte(reminders.remindAt, fromDate),
          lt(reminders.remindAt, toExclusive),
        ),
      );
    for (const r of reminderRows) {
      items.push({ id: r.id, date: toISODateString(r.remindAt), kind: 'reminder', title: r.message ?? 'Reminder', projectId: r.projectId, personId: null });
    }

    items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind.localeCompare(b.kind)));
    return ok(items);
  }
}
