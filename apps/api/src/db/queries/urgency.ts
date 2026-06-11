import { and, eq, isNotNull, ne, or } from 'drizzle-orm';
import type { UrgencyLevel } from '@lifesync/shared-types';
import { db } from '../client';
import { projects } from '../schema';

export type { UrgencyLevel };

const MS_PER_DAY = 86_400_000;

function startOfDay(value: Date): number {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

/** Whole days from `now` until `dueDate`. Negative = overdue, null = no deadline. */
export function daysUntilDue(
  dueDate: string | Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!dueDate) return null;
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  return Math.round((startOfDay(due) - startOfDay(now)) / MS_PER_DAY);
}

/**
 * Canonical deadline-intelligence level (matches the blueprint and
 * `@lifesync/shared-types`):
 *   overdue  — past due
 *   critical — due within 7 days
 *   soon     — due within 30 days
 *   on_track — due beyond 30 days
 *   no_deadline — no due date
 */
export function calculateUrgency(
  dueDate: string | Date | null | undefined,
  now: Date = new Date(),
): UrgencyLevel {
  const days = daysUntilDue(dueDate, now);
  if (days === null) return 'no_deadline';
  if (days < 0) return 'overdue';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'soon';
  return 'on_track';
}

const PRIORITY_BOOST: Record<string, number> = {
  urgent: 25,
  high: 15,
  medium: 5,
  low: 0,
  none: 0,
};

/**
 * Risk score in [0, 100] for sorting — higher is more pressing. Combines time
 * pressure (decaying from the due date) with the project's priority.
 */
export function calculateRiskScore(
  dueDate: string | Date | null | undefined,
  priority: string,
  now: Date = new Date(),
): number {
  const days = daysUntilDue(dueDate, now);
  if (days === null) return 0;

  let base: number;
  if (days < 0) base = 100;
  else if (days === 0) base = 95;
  else base = Math.max(0, Math.round(90 * (1 - days / 60))); // decays to 0 by ~60 days

  return Math.min(100, base + (PRIORITY_BOOST[priority] ?? 0));
}

export interface ProjectWithUrgency {
  project: typeof projects.$inferSelect;
  urgency: UrgencyLevel;
  daysUntilDue: number | null;
  riskScore: number;
}

/** Active, visible projects with a deadline, ranked by risk score (desc). */
export async function getProjectsWithUrgency(
  workspaceId: string,
  userId: string,
): Promise<ProjectWithUrgency[]> {
  const activeProjects = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.workspaceId, workspaceId),
        ne(projects.status, 'completed'),
        ne(projects.status, 'archived'),
        isNotNull(projects.dueDate),
        or(eq(projects.visibility, 'shared'), eq(projects.ownerId, userId)),
      ),
    );

  return activeProjects
    .map((project) => ({
      project,
      urgency: calculateUrgency(project.dueDate),
      daysUntilDue: daysUntilDue(project.dueDate),
      riskScore: calculateRiskScore(project.dueDate, project.priority),
    }))
    .sort((a, b) => b.riskScore - a.riskScore);
}

/** Projects that are overdue or critical (within the urgent window). */
export async function getProjectsDueBeforeLeadTime(
  workspaceId: string,
  userId: string,
): Promise<ProjectWithUrgency[]> {
  const urgentProjects = await getProjectsWithUrgency(workspaceId, userId);
  return urgentProjects.filter((p) => p.urgency === 'overdue' || p.urgency === 'critical');
}
