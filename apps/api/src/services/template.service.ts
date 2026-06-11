import { and, asc, eq, or } from 'drizzle-orm';
import type { z } from 'zod';
import type { Database } from '../db/client';
import { projectTemplates } from '../db/schema';
import { forbidden, internal, notFound, ok, type AppError, type Result } from '../utils/errors';
import { assertWorkspaceMembership } from '../middleware/workspace';
import type {
  createTemplateSchema,
  listTemplatesSchema,
  updateTemplateSchema,
} from '../utils/validation';

type TemplateRow = typeof projectTemplates.$inferSelect;
type ListInput = z.infer<typeof listTemplatesSchema>;
type CreateInput = z.infer<typeof createTemplateSchema>;
type UpdateInput = z.infer<typeof updateTemplateSchema>;

export class TemplateService {
  /** System templates plus this workspace's own custom templates. */
  static async list(db: Database, input: ListInput): Promise<Result<TemplateRow[], AppError>> {
    const scope = or(
      eq(projectTemplates.isSystem, true),
      eq(projectTemplates.workspaceId, input.workspaceId),
    );
    const where = input.type
      ? and(scope, eq(projectTemplates.type, input.type))
      : scope;

    const rows = await db
      .select()
      .from(projectTemplates)
      .where(where)
      .orderBy(asc(projectTemplates.name));
    return ok(rows);
  }

  static async get(
    db: Database,
    userId: string,
    id: string,
  ): Promise<Result<TemplateRow, AppError>> {
    const template = await db.query.projectTemplates.findFirst({
      where: eq(projectTemplates.id, id),
    });
    if (!template) return { success: false, error: notFound('Template not found') };

    if (!template.isSystem && template.workspaceId) {
      const member = await assertWorkspaceMembership(db, userId, template.workspaceId);
      if (!member) return { success: false, error: notFound('Template not found') };
    }
    return ok(template);
  }

  static async create(
    db: Database,
    input: CreateInput,
  ): Promise<Result<TemplateRow, AppError>> {
    const [row] = await db
      .insert(projectTemplates)
      .values({
        workspaceId: input.workspaceId,
        type: input.type,
        name: input.name,
        description: input.description ?? null,
        defaultTasks: input.defaultTasks ?? [],
        defaultFields: input.defaultFields ?? {},
        isSystem: false,
      })
      .returning();
    if (!row) return { success: false, error: internal('Failed to create template') };
    return ok(row);
  }

  static async update(
    db: Database,
    userId: string,
    input: UpdateInput,
  ): Promise<Result<TemplateRow, AppError>> {
    const existing = await db.query.projectTemplates.findFirst({
      where: eq(projectTemplates.id, input.id),
    });
    if (!existing) return { success: false, error: notFound('Template not found') };
    if (existing.isSystem || !existing.workspaceId) {
      return { success: false, error: forbidden('System templates cannot be modified') };
    }
    const member = await assertWorkspaceMembership(db, userId, existing.workspaceId);
    if (!member) return { success: false, error: notFound('Template not found') };

    const patch: Partial<TemplateRow> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.defaultTasks !== undefined) patch.defaultTasks = input.defaultTasks;
    if (input.defaultFields !== undefined) patch.defaultFields = input.defaultFields;

    if (Object.keys(patch).length === 0) return ok(existing);

    const [row] = await db
      .update(projectTemplates)
      .set(patch)
      .where(eq(projectTemplates.id, input.id))
      .returning();
    if (!row) return { success: false, error: notFound('Template not found') };
    return ok(row);
  }

  static async delete(db: Database, userId: string, id: string): Promise<Result<void, AppError>> {
    const existing = await db.query.projectTemplates.findFirst({
      where: eq(projectTemplates.id, id),
    });
    if (!existing) return { success: false, error: notFound('Template not found') };
    if (existing.isSystem || !existing.workspaceId) {
      return { success: false, error: forbidden('System templates cannot be deleted') };
    }
    const member = await assertWorkspaceMembership(db, userId, existing.workspaceId);
    if (!member) return { success: false, error: notFound('Template not found') };

    await db.delete(projectTemplates).where(eq(projectTemplates.id, id));
    return ok(undefined);
  }
}
