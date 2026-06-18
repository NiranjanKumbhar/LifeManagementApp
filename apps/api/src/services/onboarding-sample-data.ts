import { eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { householdItems, people, projects, reminders, tasks, workspaceMembers } from '../db/schema';

/**
 * Seed a small set of demo rows into the user's personal workspace so that the
 * app looks populated after the onboarding tour.  All rows are obviously labelled
 * "Sample — feel free to delete" so users know they can remove them freely.
 *
 * Called exactly once from UserService.completeOnboarding.  If any insert fails
 * we swallow the error — a bad seed must not block onboarding from completing.
 */
export async function seedSampleData(db: Database, userId: string): Promise<void> {
  // Resolve the user's personal workspace (the workspace where they are owner,
  // which was created by ensureOwnWorkspace during provisioning).
  const ownerMembership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, userId),
    // Most recently created membership — personal workspace is always first.
    orderBy: (t, { asc }) => asc(t.invitedAt),
  });
  if (!ownerMembership) return;

  const workspaceId = ownerMembership.workspaceId;

  try {
    await db.transaction(async (tx) => {
      // 1. Sample project (travel type) ──────────────────────────────────────
      const [project] = await tx
        .insert(projects)
        .values({
          workspaceId,
          type: 'travel',
          title: 'Weekend trip planning',
          description: 'Sample — feel free to delete',
          status: 'active',
          priority: 'medium',
          ownerId: userId,
          createdBy: userId,
          visibility: 'shared',
        })
        .returning();

      if (project) {
        // 1a. One task inside the sample project ─────────────────────────────
        await tx.insert(tasks).values({
          projectId: project.id,
          title: 'Book accommodation',
          description: 'Sample — feel free to delete',
          status: 'pending',
          priority: 'medium',
          ownerId: userId,
          createdBy: userId,
          visibility: 'shared',
        });
      }

      // 2. Sample household item ─────────────────────────────────────────────
      await tx.insert(householdItems).values({
        workspaceId,
        name: 'Coffee',
        category: 'groceries',
        status: 'on_list',
        visibility: 'shared',
        addedBy: userId,
      });

      // 3. Sample person — birthday ~1 month from now so the upcoming-dates
      //    strip in the People and Dashboard screens shows a real entry.
      const birthdayDate = new Date();
      birthdayDate.setMonth(birthdayDate.getMonth() + 1);
      const birthdayISO = birthdayDate.toISOString().split('T')[0]; // YYYY-MM-DD

      await tx.insert(people).values({
        workspaceId,
        name: 'Mum',
        relationship: 'family',
        birthday: birthdayISO,
        notes: 'Sample — feel free to delete',
      });

      // 4. Sample reminder — due in 2 days ──────────────────────────────────
      const remindAt = new Date();
      remindAt.setDate(remindAt.getDate() + 2);

      await tx.insert(reminders).values({
        userId,
        remindAt,
        type: 'standard',
        severity: 'info',
        message: 'Check in with each other this week — Sample, feel free to delete',
      });
    });
  } catch {
    // Seed failures are non-fatal; onboarding completes regardless.
  }
}
