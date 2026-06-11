import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { Database } from '../db/client';
import { people, resources, tasks } from '../db/schema';
import { internal, notFound, ok, type AppError, type Result } from '../utils/errors';
import { assertWorkspaceMembership } from '../middleware/workspace';
import { loadReadableProject, loadWritableProject } from './authz';
import { logActivity } from './activity';
import type { listResourcesSchema, uploadResourceSchema } from '../utils/validation';

type ResourceRow = typeof resources.$inferSelect;
type ListInput = z.infer<typeof listResourcesSchema>;
type UploadInput = z.infer<typeof uploadResourceSchema>;

const ENTITY = 'resource';

/** Resolve the workspace for a parent entity, authorizing read or write access. */
async function resolveParent(
  db: Database,
  userId: string,
  entityType: 'project' | 'task' | 'person',
  entityId: string,
  mode: 'read' | 'write',
): Promise<Result<{ workspaceId: string }, AppError>> {
  if (entityType === 'project') {
    const access =
      mode === 'write'
        ? await loadWritableProject(db, userId, entityId)
        : await loadReadableProject(db, userId, entityId);
    if (!access.success) return access;
    return ok({ workspaceId: access.data.workspaceId });
  }

  if (entityType === 'task') {
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, entityId) });
    if (!task) return { success: false, error: notFound('Task not found') };
    const access =
      mode === 'write'
        ? await loadWritableProject(db, userId, task.projectId)
        : await loadReadableProject(db, userId, task.projectId);
    if (!access.success) return access;
    return ok({ workspaceId: access.data.workspaceId });
  }

  // person
  const person = await db.query.people.findFirst({ where: eq(people.id, entityId) });
  if (!person) return { success: false, error: notFound('Person not found') };
  const member = await assertWorkspaceMembership(db, userId, person.workspaceId);
  if (!member) return { success: false, error: notFound('Person not found') };
  return ok({ workspaceId: person.workspaceId });
}

export class ResourceService {
  static async list(
    db: Database,
    userId: string,
    input: ListInput,
  ): Promise<Result<ResourceRow[], AppError>> {
    let column;
    let entityType: 'project' | 'task' | 'person';
    let entityId: string;

    if (input.projectId) {
      entityType = 'project';
      entityId = input.projectId;
      column = resources.projectId;
    } else if (input.taskId) {
      entityType = 'task';
      entityId = input.taskId;
      column = resources.taskId;
    } else {
      entityType = 'person';
      entityId = input.personId!;
      column = resources.personId;
    }

    const access = await resolveParent(db, userId, entityType, entityId, 'read');
    if (!access.success) return access;

    const rows = await db.select().from(resources).where(eq(column, entityId));
    return ok(rows);
  }

  /** Register a file that was uploaded to object storage. */
  static async upload(
    db: Database,
    userId: string,
    input: UploadInput,
  ): Promise<Result<ResourceRow, AppError>> {
    const access = await resolveParent(db, userId, input.entityType, input.entityId, 'write');
    if (!access.success) return access;

    try {
      const resource = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(resources)
          .values({
            projectId: input.entityType === 'project' ? input.entityId : null,
            taskId: input.entityType === 'task' ? input.entityId : null,
            personId: input.entityType === 'person' ? input.entityId : null,
            name: input.name,
            fileType: input.fileType,
            storagePath: input.storageUrl,
            sizeBytes: input.sizeBytes ?? null,
            uploadedBy: userId,
          })
          .returning();
        if (!row) throw new Error('insert returned no row');
        await logActivity(tx, {
          workspaceId: access.data.workspaceId,
          userId,
          entityType: ENTITY,
          entityId: row.id,
          action: 'created',
        });
        return row;
      });
      return ok(resource);
    } catch (e) {
      return { success: false, error: internal('Failed to register resource', { cause: String(e) }) };
    }
  }

  static async delete(db: Database, userId: string, id: string): Promise<Result<void, AppError>> {
    const resource = await db.query.resources.findFirst({ where: eq(resources.id, id) });
    if (!resource) return { success: false, error: notFound('Resource not found') };

    const parentType: 'project' | 'task' | 'person' = resource.projectId
      ? 'project'
      : resource.taskId
        ? 'task'
        : 'person';
    const parentId = (resource.projectId ?? resource.taskId ?? resource.personId)!;

    const access = await resolveParent(db, userId, parentType, parentId, 'write');
    if (!access.success) return access;

    try {
      await db.transaction(async (tx) => {
        await tx.delete(resources).where(eq(resources.id, id));
        await logActivity(tx, {
          workspaceId: access.data.workspaceId,
          userId,
          entityType: ENTITY,
          entityId: id,
          action: 'deleted',
        });
      });
      // NOTE: the object in Supabase Storage is removed separately (cleanup job
      // or storage service) — this only deletes the metadata record.
      return ok(undefined);
    } catch (e) {
      return { success: false, error: internal('Failed to delete resource', { cause: String(e) }) };
    }
  }
}
