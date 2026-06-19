import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { Resend } from 'resend';
import { db } from '../db/client';
import {
  householdItems,
  projects,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from '../db/schema';
import { inngest } from './inngest';

let resendInstance: Resend | undefined;
function resend(): Resend {
  return (resendInstance ??= new Resend(process.env['RESEND_API_KEY']));
}
const FROM_EMAIL = process.env['FROM_EMAIL'] ?? 'onboarding@resend.dev';

const DIGEST_HORIZON_DAYS = 7;
const SHOPPING_STATUSES = ['on_list', 'low', 'out'] as const;

type DeadlineItem = { kind: 'project' | 'task'; title: string; dueDate: string };
type ShoppingItem = { name: string; category: string; status: string };

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export const sendWeeklyDigest = inngest.createFunction(
  { id: 'send-weekly-digest', name: 'Send Weekly Digest' },
  { cron: '0 8 * * 1' },
  async ({ step, logger }) => {
    const today = new Date();
    const fromDate = isoDate(today);
    const horizon = new Date(today);
    horizon.setUTCDate(horizon.getUTCDate() + DIGEST_HORIZON_DAYS);
    const toDate = isoDate(horizon);

    const targetWorkspaces = await step.run('get-workspaces', async () => {
      const rows = await db
        .selectDistinct({
          workspaceId: workspaces.id,
          workspaceName: workspaces.name,
        })
        .from(workspaces)
        .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id));
      return rows;
    });

    if (targetWorkspaces.length === 0) {
      return { workspacesProcessed: 0, emailsSent: 0 };
    }

    let emailsSent = 0;

    for (const ws of targetWorkspaces) {
      const sent = await step.run(`digest-${ws.workspaceId}`, async () => {
        const members = await db
          .select({
            id: users.id,
            email: users.email,
            displayName: users.displayName,
            notificationPreferences: users.notificationPreferences,
          })
          .from(workspaceMembers)
          .innerJoin(users, eq(users.id, workspaceMembers.userId))
          .where(eq(workspaceMembers.workspaceId, ws.workspaceId));

        const eligible = members.filter((m) => {
          const prefs = m.notificationPreferences;
          if (prefs?.digestMode === 'none') return false;
          if (prefs?.channels?.email === false) return false;
          return Boolean(m.email);
        });

        if (eligible.length === 0) return 0;

        const dueProjects = await db
          .select({ title: projects.title, dueDate: projects.dueDate })
          .from(projects)
          .where(
            and(
              eq(projects.workspaceId, ws.workspaceId),
              eq(projects.status, 'active'),
              eq(projects.visibility, 'shared'),
              gte(projects.dueDate, fromDate),
              lte(projects.dueDate, toDate),
            ),
          );

        const dueTasks = await db
          .select({ title: tasks.title, dueDate: tasks.dueDate })
          .from(tasks)
          .innerJoin(projects, eq(projects.id, tasks.projectId))
          .where(
            and(
              eq(projects.workspaceId, ws.workspaceId),
              eq(tasks.visibility, 'shared'),
              inArray(tasks.status, ['pending', 'in_progress']),
              gte(tasks.dueDate, fromDate),
              lte(tasks.dueDate, toDate),
            ),
          );

        const deadlines: DeadlineItem[] = [
          ...dueProjects
            .filter((p): p is { title: string; dueDate: string } => p.dueDate !== null)
            .map((p) => ({ kind: 'project' as const, title: p.title, dueDate: p.dueDate })),
          ...dueTasks
            .filter((t): t is { title: string; dueDate: string } => t.dueDate !== null)
            .map((t) => ({ kind: 'task' as const, title: t.title, dueDate: t.dueDate })),
        ].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

        const lowStock = await db
          .select({
            name: householdItems.name,
            category: householdItems.category,
            status: householdItems.status,
          })
          .from(householdItems)
          .where(
            and(
              eq(householdItems.workspaceId, ws.workspaceId),
              eq(householdItems.visibility, 'shared'),
              inArray(householdItems.status, [...SHOPPING_STATUSES]),
            ),
          );

        const shopping: ShoppingItem[] = lowStock.map((i) => ({
          name: i.name,
          category: i.category,
          status: i.status,
        }));

        if (deadlines.length === 0 && shopping.length === 0) return 0;

        const html = buildDigestEmail(ws.workspaceName, deadlines, shopping);

        let count = 0;
        for (const member of eligible) {
          await resend().emails.send({
            from: FROM_EMAIL,
            to: member.email,
            subject: 'Your Weekly LifeSync Digest',
            html,
          });
          count++;
        }
        return count;
      });

      emailsSent += sent;
    }

    logger.info(
      `Weekly digest: processed ${targetWorkspaces.length} workspace(s), sent ${emailsSent} email(s)`,
    );

    return { workspacesProcessed: targetWorkspaces.length, emailsSent };
  },
);

function buildDigestEmail(
  workspaceName: string,
  deadlines: DeadlineItem[],
  shopping: ShoppingItem[],
): string {
  const deadlinesSection =
    deadlines.length > 0
      ? `
        <h2 style="font-size: 16px; font-weight: 600; margin: 28px 0 12px;">Upcoming Deadlines</h2>
        <ul style="list-style: none; padding: 0; margin: 0;">
          ${deadlines
            .map(
              (d) => `
            <li style="padding: 10px 16px; margin-bottom: 8px; background: #f9f6f2; border-left: 3px solid #2a9d8f; border-radius: 6px;">
              <span style="font-size: 15px;">${escHtml(d.title)}</span>
              <span style="display: block; font-size: 12px; color: #9e998f; margin-top: 2px;">
                ${d.kind === 'project' ? 'Project' : 'Task'} &middot; due ${escHtml(d.dueDate)}
              </span>
            </li>`,
            )
            .join('')}
        </ul>`
      : '';

  const shoppingSection =
    shopping.length > 0
      ? `
        <h2 style="font-size: 16px; font-weight: 600; margin: 28px 0 12px;">Shopping Needed</h2>
        <ul style="list-style: none; padding: 0; margin: 0;">
          ${shopping
            .map(
              (s) => `
            <li style="padding: 10px 16px; margin-bottom: 8px; background: #f9f6f2; border-left: 3px solid #2a9d8f; border-radius: 6px;">
              <span style="font-size: 15px;">${escHtml(s.name)}</span>
              <span style="display: block; font-size: 12px; color: #9e998f; margin-top: 2px;">
                ${escHtml(s.category)}
              </span>
            </li>`,
            )
            .join('')}
        </ul>`
      : '';

  return `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #2d2a26;">
      <h1 style="font-size: 22px; font-weight: 600; margin-bottom: 4px;">Your Weekly LifeSync Digest</h1>
      <p style="color: #6b6560; margin-bottom: 8px;">${escHtml(workspaceName)}</p>
      ${deadlinesSection}
      ${shoppingSection}
      <p style="margin-top: 32px; font-size: 12px; color: #9e998f;">
        You're receiving this weekly summary from LifeSync. Adjust digest settings in your notification preferences.
      </p>
    </div>
  `;
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
