import { and, asc, eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { Database } from '../db/client';
import { householdItems } from '../db/schema';
import { internal, notFound, ok, type AppError, type Result } from '../utils/errors';
import { assertWorkspaceMembership } from '../middleware/workspace';
import { logActivity } from './activity';
import { resolveUsers } from './resolve-users';
import type { HouseholdItemListItem } from '@lifesync/shared-types';
import type {
  createHouseholdSchema,
  listHouseholdSchema,
  updateHouseholdSchema,
} from '../utils/validation';

type ItemRow = typeof householdItems.$inferSelect;
type ListInput = z.infer<typeof listHouseholdSchema>;
type CreateInput = z.infer<typeof createHouseholdSchema>;
type UpdateInput = z.infer<typeof updateHouseholdSchema>;

const ENTITY = 'household_item';

export class HouseholdService {
  static async list(
    db: Database,
    userId: string,
    input: ListInput,
  ): Promise<Result<HouseholdItemListItem[], AppError>> {
    const conditions = [eq(householdItems.workspaceId, input.workspaceId)];
    if (input.status) conditions.push(eq(householdItems.status, input.status));
    if (input.category) conditions.push(eq(householdItems.category, input.category));

    const rows = await db
      .select()
      .from(householdItems)
      .where(and(...conditions))
      .orderBy(asc(householdItems.category), asc(householdItems.sortOrder));

    const visible = rows.filter((r) => r.visibility !== 'private' || r.addedBy === userId);

    const userMap = await resolveUsers(db, visible.flatMap((r) => [r.addedBy, r.lastPurchasedBy]));
    return ok(
      visible.map((r) => ({
        ...r,
        addedByUser: userMap.get(r.addedBy ?? '') ?? null,
        lastPurchasedByUser: userMap.get(r.lastPurchasedBy ?? '') ?? null,
      })),
    );
  }

  static async add(
    db: Database,
    userId: string,
    input: CreateInput,
  ): Promise<Result<ItemRow, AppError>> {
    try {
      const item = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(householdItems)
          .values({
            workspaceId: input.workspaceId,
            name: input.name,
            category: input.category ?? 'other',
            status: input.status ?? 'stocked',
            quantity: input.quantity ?? null,
            unit: input.unit ?? null,
            autoReplenish: input.autoReplenish ?? false,
            addedBy: userId,
            visibility: input.visibility ?? 'shared',
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
      return ok(item);
    } catch (e) {
      return { success: false, error: internal('Failed to add item', { cause: String(e) }) };
    }
  }

  static async update(
    db: Database,
    userId: string,
    input: UpdateInput,
  ): Promise<Result<ItemRow, AppError>> {
    const existing = await db.query.householdItems.findFirst({
      where: eq(householdItems.id, input.id),
    });
    if (!existing) return { success: false, error: notFound('Item not found') };
    if (!(await assertWorkspaceMembership(db, userId, existing.workspaceId))) {
      return { success: false, error: notFound('Item not found') };
    }
    if (existing.visibility === 'private' && existing.addedBy !== userId) {
      return { success: false, error: notFound('Item not found') };
    }

    const patch: Partial<ItemRow> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.category !== undefined) patch.category = input.category;
    if (input.status !== undefined) patch.status = input.status;
    if (input.quantity !== undefined) patch.quantity = input.quantity;
    if (input.unit !== undefined) patch.unit = input.unit;
    if (input.autoReplenish !== undefined) patch.autoReplenish = input.autoReplenish;

    return this.applyUpdate(db, userId, existing, patch);
  }

  /** Mark as purchased: stocked + record the purchase time. */
  static async purchase(
    db: Database,
    userId: string,
    id: string,
  ): Promise<Result<ItemRow, AppError>> {
    const existing = await db.query.householdItems.findFirst({ where: eq(householdItems.id, id) });
    if (!existing) return { success: false, error: notFound('Item not found') };
    if (!(await assertWorkspaceMembership(db, userId, existing.workspaceId))) {
      return { success: false, error: notFound('Item not found') };
    }
    if (existing.visibility === 'private' && existing.addedBy !== userId) {
      return { success: false, error: notFound('Item not found') };
    }
    return this.applyUpdate(db, userId, existing, {
      status: 'stocked',
      lastPurchased: new Date(),
      lastPurchasedBy: userId,
      updatedAt: new Date(),
    });
  }

  /** Flag as needing restock (back on the shopping list). */
  static async restock(
    db: Database,
    userId: string,
    id: string,
  ): Promise<Result<ItemRow, AppError>> {
    const existing = await db.query.householdItems.findFirst({ where: eq(householdItems.id, id) });
    if (!existing) return { success: false, error: notFound('Item not found') };
    if (!(await assertWorkspaceMembership(db, userId, existing.workspaceId))) {
      return { success: false, error: notFound('Item not found') };
    }
    if (existing.visibility === 'private' && existing.addedBy !== userId) {
      return { success: false, error: notFound('Item not found') };
    }
    return this.applyUpdate(db, userId, existing, { status: 'out', updatedAt: new Date() });
  }

  private static async applyUpdate(
    db: Database,
    userId: string,
    existing: ItemRow,
    patch: Partial<ItemRow>,
  ): Promise<Result<ItemRow, AppError>> {
    try {
      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(householdItems)
          .set(patch)
          .where(eq(householdItems.id, existing.id))
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
      return { success: false, error: internal('Failed to update item', { cause: String(e) }) };
    }
  }
}
