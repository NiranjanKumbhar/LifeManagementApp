import { eq, ne, or } from 'drizzle-orm';
import type { Database } from '../db/client';
import { projects } from '../db/schema';
import { forbidden, notFound, ok, type AppError, type Result } from '../utils/errors';
import { assertWorkspaceMembership } from '../middleware/workspace';

type ProjectRow = typeof projects.$inferSelect;

/** Visibility condition for a workspace-scoped project query. */
export function projectVisibilityCondition(userId: string) {
  return or(ne(projects.visibility, 'private'), eq(projects.ownerId, userId));
}

export function canReadProject(p: Pick<ProjectRow, 'visibility' | 'ownerId'>, userId: string): boolean {
  if (p.visibility === 'private') return p.ownerId === userId;
  return true;
}

export function canWriteProject(
  p: Pick<ProjectRow, 'visibility' | 'ownerId'>,
  userId: string,
): boolean {
  if (p.visibility === 'shared') return true;
  // mine_visible and private are editable only by their owner
  return p.ownerId === userId;
}

/** Load a project, authorizing read access. NOT_FOUND hides existence on denial. */
export async function loadReadableProject(
  db: Database,
  userId: string,
  projectId: string,
): Promise<Result<ProjectRow, AppError>> {
  const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  if (!project) return { success: false, error: notFound('Project not found') };

  const member = await assertWorkspaceMembership(db, userId, project.workspaceId);
  if (!member || !canReadProject(project, userId)) {
    return { success: false, error: notFound('Project not found') };
  }
  return ok(project);
}

/** Load a project, authorizing write access. */
export async function loadWritableProject(
  db: Database,
  userId: string,
  projectId: string,
): Promise<Result<ProjectRow, AppError>> {
  const res = await loadReadableProject(db, userId, projectId);
  if (!res.success) return res;
  if (!canWriteProject(res.data, userId)) {
    return { success: false, error: forbidden('You cannot edit this project') };
  }
  return res;
}
