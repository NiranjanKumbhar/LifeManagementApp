import { eq } from 'drizzle-orm';
import type { z } from 'zod';
import type { Database } from '../db/client';
import { users } from '../db/schema';
import { notFound, ok, type AppError, type Result } from '../utils/errors';
import type { updateNotificationPrefsSchema, updateProfileSchema } from '../utils/validation';

type UserRow = typeof users.$inferSelect;
type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
type UpdatePrefsInput = z.infer<typeof updateNotificationPrefsSchema>;

export class UserService {
  static async me(db: Database, userId: string): Promise<Result<UserRow, AppError>> {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    if (!user) return { success: false, error: notFound('User not found') };
    return ok(user);
  }

  static async updateProfile(
    db: Database,
    userId: string,
    input: UpdateProfileInput,
  ): Promise<Result<UserRow, AppError>> {
    const patch: Partial<UserRow> = { updatedAt: new Date() };
    if (input.displayName !== undefined) patch.displayName = input.displayName;
    if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;
    if (input.timezone !== undefined) patch.timezone = input.timezone;

    const [row] = await db.update(users).set(patch).where(eq(users.id, userId)).returning();
    if (!row) return { success: false, error: notFound('User not found') };
    return ok(row);
  }

  static async updateNotificationPrefs(
    db: Database,
    userId: string,
    input: UpdatePrefsInput,
  ): Promise<Result<UserRow, AppError>> {
    const [row] = await db
      .update(users)
      .set({ notificationPreferences: input.preferences, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (!row) return { success: false, error: notFound('User not found') };
    return ok(row);
  }
}
