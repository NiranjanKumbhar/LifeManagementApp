import { and, eq, isNull, lte, or } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '../db/client';
import {
  notifications,
  projects,
  reminders,
  tasks,
  users,
  workspaceMembers,
} from '../db/schema';
import { inngest } from './inngest';

// Lazily construct so importing this module never requires RESEND_API_KEY
// (Next.js build collects page data by importing route handlers).
let resendInstance: Resend | undefined;
function resend(): Resend {
  return (resendInstance ??= new Resend(process.env['RESEND_API_KEY']));
}
// Falls back to Resend's sandbox sender (only delivers to the Resend account owner).
// Replace with a verified domain address before going to production.
const FROM_EMAIL = process.env['FROM_EMAIL'] ?? 'onboarding@resend.dev';

/** Resolve the workspaceId for a reminder via its parent project/task, or the user's membership. */
async function resolveWorkspace(
  reminderId: string,
  projectId: string | null,
  taskId: string | null,
  userId: string,
): Promise<string | null> {
  if (projectId) {
    const proj = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
    if (proj) return proj.workspaceId;
  }

  if (taskId) {
    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) });
    if (task) {
      const proj = await db.query.projects.findFirst({ where: eq(projects.id, task.projectId) });
      if (proj) return proj.workspaceId;
    }
  }

  // Standalone reminder — fall back to the user's first workspace
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, userId),
  });
  return membership?.workspaceId ?? null;
}

/**
 * Cron job: runs every 5 minutes. Finds all unsent reminders whose fire time
 * has passed (accounting for snooze), creates an in-app notification, sends an
 * email via Resend (if the user has email enabled), and marks the reminder sent.
 */
export const deliverReminders = inngest.createFunction(
  { id: 'deliver-due-reminders', name: 'Deliver Due Reminders' },
  { cron: '*/5 * * * *' },
  async ({ step, logger }) => {
    const now = new Date();

    const due = await step.run('find-due-reminders', () =>
      db
        .select({
          reminder: reminders,
          user: {
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            notificationPreferences: users.notificationPreferences,
          },
        })
        .from(reminders)
        .innerJoin(users, eq(reminders.userId, users.id))
        .where(
          and(
            lte(reminders.remindAt, now),
            eq(reminders.isSent, false),
            or(isNull(reminders.snoozedUntil), lte(reminders.snoozedUntil, now)),
          ),
        )
        .limit(100),
    );

    if (due.length === 0) {
      return { delivered: 0 };
    }

    logger.info(`Delivering ${due.length} reminder(s)`);

    let delivered = 0;
    for (const { reminder: r, user: u } of due) {
      await step.run(`deliver-${r.id}`, async () => {
        const workspaceId = await resolveWorkspace(r.id, r.projectId, r.taskId, r.userId);
        if (!workspaceId) {
          logger.warn(`Skipping reminder ${r.id}: could not resolve workspace`);
          return;
        }

        const title = r.message ?? 'You have a reminder';

        // Create in-app notification
        await db.insert(notifications).values({
          userId: r.userId,
          workspaceId,
          type: 'reminder',
          title,
          body: r.message ?? null,
          entityType: r.projectId ? 'project' : r.taskId ? 'task' : null,
          entityId: r.projectId ?? r.taskId ?? null,
        });

        // Send email unless user explicitly disabled it
        const prefs = u.notificationPreferences;
        const emailEnabled = prefs?.channels?.email !== false;

        if (emailEnabled && u.email) {
          await resend().emails.send({
            from: FROM_EMAIL,
            to: u.email,
            subject: `Reminder: ${title}`,
            html: buildReminderEmail(u.displayName, title),
          });
        }

        // Mark sent
        await db
          .update(reminders)
          .set({ isSent: true, sentAt: new Date() })
          .where(eq(reminders.id, r.id));
      });
      delivered++;
    }

    return { delivered };
  },
);

function buildReminderEmail(name: string, title: string): string {
  return `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #2d2a26;">
      <h1 style="font-size: 22px; font-weight: 600; margin-bottom: 8px;">Reminder</h1>
      <p style="color: #6b6560; margin-bottom: 24px;">Hi ${escHtml(name)},</p>
      <div style="background: #f9f6f2; border-left: 3px solid #2a9d8f; padding: 16px 20px; border-radius: 6px;">
        <p style="margin: 0; font-size: 16px;">${escHtml(title)}</p>
      </div>
      <p style="margin-top: 32px; font-size: 12px; color: #9e998f;">
        You're receiving this because you set a reminder in LifeSync.
      </p>
    </div>
  `;
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
