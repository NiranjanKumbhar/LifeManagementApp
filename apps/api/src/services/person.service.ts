import { asc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { Database } from '../db/client';
import { people } from '../db/schema';
import type { projects } from '../db/schema';
import { internal, notFound, ok, type AppError, type Result } from '../utils/errors';
import { assertWorkspaceMembership } from '../middleware/workspace';
import { logActivity } from './activity';
import type {
  createPersonSchema,
  updatePersonSchema,
} from '../utils/validation';

type PersonRow = typeof people.$inferSelect;
type ProjectRow = typeof projects.$inferSelect;
type CreateInput = z.infer<typeof createPersonSchema>;
type UpdateInput = z.infer<typeof updatePersonSchema>;

export interface PersonWithProjects extends PersonRow {
  projects: ProjectRow[];
}

const ENTITY = 'person';

export class PersonService {
  static async list(db: Database, workspaceId: string): Promise<Result<PersonRow[], AppError>> {
    const rows = await db
      .select()
      .from(people)
      .where(eq(people.workspaceId, workspaceId))
      .orderBy(asc(people.name));
    return ok(rows);
  }

  static async get(
    db: Database,
    userId: string,
    id: string,
  ): Promise<Result<PersonWithProjects, AppError>> {
    const person = await db.query.people.findFirst({ where: eq(people.id, id) });
    if (!person) return { success: false, error: notFound('Person not found') };

    const member = await assertWorkspaceMembership(db, userId, person.workspaceId);
    if (!member) return { success: false, error: notFound('Person not found') };

    // Note: there is no person↔project FK yet, so linked projects are empty.
    // When a `person_id` column is added to projects, query it here.
    return ok({ ...person, projects: [] });
  }

  static async create(
    db: Database,
    userId: string,
    input: CreateInput,
  ): Promise<Result<PersonRow, AppError>> {
    try {
      const person = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(people)
          .values({
            workspaceId: input.workspaceId,
            name: input.name,
            relationship: input.relationship ?? null,
            birthday: input.birthday ?? null,
            anniversary: input.anniversary ?? null,
            email: input.email ?? null,
            phone: input.phone ?? null,
            notes: input.notes ?? null,
            giftIdeas: input.giftIdeas ?? [],
            customFields: input.customFields ?? {},
          })
          .returning();
        if (!row) throw new Error('insert returned no row');
        await logActivity(tx, {
          workspaceId: row.workspaceId,
          userId,
          entityType: ENTITY,
          entityId: row.id,
          action: 'created',
        });
        return row;
      });
      return ok(person);
    } catch (e) {
      return { success: false, error: internal('Failed to create person', { cause: String(e) }) };
    }
  }

  static async update(
    db: Database,
    userId: string,
    input: UpdateInput,
  ): Promise<Result<PersonRow, AppError>> {
    const existing = await db.query.people.findFirst({ where: eq(people.id, input.id) });
    if (!existing) return { success: false, error: notFound('Person not found') };

    const member = await assertWorkspaceMembership(db, userId, existing.workspaceId);
    if (!member) return { success: false, error: notFound('Person not found') };

    const patch: Partial<PersonRow> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.relationship !== undefined) patch.relationship = input.relationship;
    if (input.birthday !== undefined) patch.birthday = input.birthday;
    if (input.anniversary !== undefined) patch.anniversary = input.anniversary;
    if (input.email !== undefined) patch.email = input.email;
    if (input.phone !== undefined) patch.phone = input.phone;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.giftIdeas !== undefined) patch.giftIdeas = input.giftIdeas;
    if (input.customFields !== undefined) patch.customFields = input.customFields;

    try {
      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(people)
          .set(patch)
          .where(eq(people.id, input.id))
          .returning();
        if (!row) throw new Error('update returned no row');
        await logActivity(tx, {
          workspaceId: row.workspaceId,
          userId,
          entityType: ENTITY,
          entityId: row.id,
          action: 'updated',
        });
        return row;
      });
      return ok(updated);
    } catch (e) {
      return { success: false, error: internal('Failed to update person', { cause: String(e) }) };
    }
  }

  static async delete(
    db: Database,
    userId: string,
    id: string,
  ): Promise<Result<{ id: string }, AppError>> {
    const existing = await db.query.people.findFirst({ where: eq(people.id, id) });
    if (!existing) return { success: false, error: notFound('Person not found') };

    const member = await assertWorkspaceMembership(db, userId, existing.workspaceId);
    if (!member) return { success: false, error: notFound('Person not found') };

    try {
      await db.transaction(async (tx) => {
        await tx.delete(people).where(eq(people.id, id));
        await logActivity(tx, {
          workspaceId: existing.workspaceId,
          userId,
          entityType: ENTITY,
          entityId: id,
          action: 'deleted',
        });
      });
      return ok({ id });
    } catch (e) {
      return { success: false, error: internal('Failed to delete person', { cause: String(e) }) };
    }
  }
}
