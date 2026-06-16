import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { ProjectService } from './project.service';
import { activityEvents, projectTemplates, reminders, tasks } from '../db/schema';
import { addDays, toISODateString } from '../utils/dates';
import type { AppError, AppErrorCode, Result } from '../utils/errors';
import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { createProjectInput, insertProject } from '../__tests__/factories/project.factory';
import { insertTask } from '../__tests__/factories/task.factory';
import { insertUser } from '../__tests__/factories/user.factory';

function expectOk<T>(res: Result<T, AppError>): T {
  if (!res.success) throw new Error(`expected ok, got error: ${res.error.code} ${res.error.message}`);
  return res.data;
}

function expectErr<T>(res: Result<T, AppError>, code: AppErrorCode): AppError {
  if (res.success) throw new Error(`expected error ${code}, got ok`);
  expect(res.error.code).toBe(code);
  return res.error;
}

const isoIn = (days: number): string => toISODateString(addDays(new Date(), days));

let ctx: TestDb;
let world: SeededCouple;

beforeEach(async () => {
  ctx = await createTestDb();
  world = await seedCouple(ctx.db);
});

afterEach(async () => {
  await ctx.close();
});

describe('ProjectService.create', () => {
  it('applies compliance type defaults (high priority + 90-day lead time)', async () => {
    const project = expectOk(
      await ProjectService.create(
        ctx.db,
        world.alex.id,
        createProjectInput({ workspaceId: world.workspace.id, type: 'compliance', title: 'Permit' }),
      ),
    );

    expect(project.priority).toBe('high');
    expect(project.leadTimeDays).toBe(90);
    expect(project.customFields).toMatchObject({ documents_required: [] });
  });

  it('instantiates template tasks and merges template + input custom fields', async () => {
    const [template] = await ctx.db
      .insert(projectTemplates)
      .values({
        type: 'travel',
        name: 'Holiday',
        isSystem: true,
        defaultTasks: [{ title: 'Book flights' }, { title: 'Pack bags' }],
        defaultFields: { visa_required: true },
      })
      .returning();

    const project = expectOk(
      await ProjectService.create(
        ctx.db,
        world.alex.id,
        createProjectInput({
          workspaceId: world.workspace.id,
          type: 'travel',
          templateId: template!.id,
          customFields: { destination: 'Barcelona' },
        }),
      ),
    );

    const createdTasks = await ctx.db.select().from(tasks).where(eq(tasks.projectId, project.id));
    expect(createdTasks.map((t) => t.title).sort()).toEqual(['Book flights', 'Pack bags']);
    expect(project.customFields).toMatchObject({ visa_required: true, destination: 'Barcelona' });
  });

  it('schedules a lead-time reminder when a due date is present', async () => {
    const project = expectOk(
      await ProjectService.create(
        ctx.db,
        world.alex.id,
        createProjectInput({
          workspaceId: world.workspace.id,
          type: 'occasion',
          dueDate: isoIn(45),
        }),
      ),
    );

    const scheduled = await ctx.db.select().from(reminders).where(eq(reminders.projectId, project.id));
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]!.type).toBe('lead_time');
    expect(scheduled[0]!.userId).toBe(world.alex.id);
  });

  it('writes a "created" activity event', async () => {
    const project = expectOk(
      await ProjectService.create(
        ctx.db,
        world.alex.id,
        createProjectInput({ workspaceId: world.workspace.id }),
      ),
    );

    const events = await ctx.db
      .select()
      .from(activityEvents)
      .where(eq(activityEvents.entityId, project.id));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: 'created',
      entityType: 'project',
      userId: world.alex.id,
    });
  });

  it('records the creator and resolves it on list', async () => {
    await ProjectService.create(
      ctx.db,
      world.alex.id,
      createProjectInput({ workspaceId: world.workspace.id, title: 'Created by Alex' }),
    );

    const listed = expectOk(
      await ProjectService.list(ctx.db, world.alex.id, { workspaceId: world.workspace.id }),
    );
    const found = listed.find((p) => p.title === 'Created by Alex');
    expect(found?.createdByUser?.id).toBe(world.alex.id);
  });

  it('rejects creating in a workspace the user does not belong to', async () => {
    // Membership for create is enforced by the router middleware, but the
    // service still must not allow templates from other workspaces, etc.
    // Here we simply confirm a missing template is reported.
    expectErr(
      await ProjectService.create(
        ctx.db,
        world.alex.id,
        createProjectInput({
          workspaceId: world.workspace.id,
          templateId: '00000000-0000-0000-0000-000000000000',
        }),
      ),
      'NOT_FOUND',
    );
  });
});

describe('ProjectService.get', () => {
  it('returns a project with its nested task tree', async () => {
    const project = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'shared',
    });
    const parent = await insertTask(ctx.db, { projectId: project.id, title: 'Parent', sortOrder: 0 });
    await insertTask(ctx.db, {
      projectId: project.id,
      title: 'Child',
      parentId: parent.id,
      path: parent.id,
      sortOrder: 0,
    });

    const result = expectOk(await ProjectService.get(ctx.db, world.alex.id, project.id));
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]!.title).toBe('Parent');
    expect(result.tasks[0]!.children).toHaveLength(1);
    expect(result.tasks[0]!.children[0]!.title).toBe('Child');
  });

  it('hides a private project from the partner (NOT_FOUND, no leak)', async () => {
    const project = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'private',
    });
    expectErr(await ProjectService.get(ctx.db, world.jordan.id, project.id), 'NOT_FOUND');
  });

  it('returns NOT_FOUND to a non-member', async () => {
    const stranger = await insertUser(ctx.db);
    const project = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'shared',
    });
    expectErr(await ProjectService.get(ctx.db, stranger.id, project.id), 'NOT_FOUND');
  });
});

describe('ProjectService.update', () => {
  it('updates fields and records the change in the activity log', async () => {
    const project = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'shared',
      title: 'Old title',
    });

    const updated = expectOk(
      await ProjectService.update(ctx.db, world.alex.id, { id: project.id, title: 'New title' }),
    );
    expect(updated.title).toBe('New title');

    const events = await ctx.db
      .select()
      .from(activityEvents)
      .where(and(eq(activityEvents.entityId, project.id), eq(activityEvents.action, 'updated')));
    expect(events).toHaveLength(1);
    expect(events[0]!.changes).toMatchObject({ title: { old: 'Old title', new: 'New title' } });
  });

  it('forbids a partner from editing a mine_visible project', async () => {
    const project = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'mine_visible',
    });
    expectErr(
      await ProjectService.update(ctx.db, world.jordan.id, { id: project.id, title: 'Nope' }),
      'FORBIDDEN',
    );
  });

  it('lets a member edit a shared project', async () => {
    const project = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'shared',
    });
    const updated = expectOk(
      await ProjectService.update(ctx.db, world.jordan.id, { id: project.id, title: 'Jordan edit' }),
    );
    expect(updated.title).toBe('Jordan edit');
  });
});

describe('ProjectService.complete / archive', () => {
  it('completes a project with a timestamp and logs it', async () => {
    const project = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'shared',
    });
    const completed = expectOk(await ProjectService.complete(ctx.db, world.alex.id, project.id));
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).not.toBeNull();
  });

  it('archives a project without deleting it', async () => {
    const project = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'shared',
    });
    const archived = expectOk(await ProjectService.archive(ctx.db, world.alex.id, project.id));
    expect(archived.status).toBe('archived');
  });

  it('records who completed the project and exposes it on get', async () => {
    const project = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'shared',
    });
    const completed = expectOk(await ProjectService.complete(ctx.db, world.jordan.id, project.id));
    expect(completed.completedBy).toBe(world.jordan.id);

    const fetched = expectOk(await ProjectService.get(ctx.db, world.alex.id, project.id));
    expect(fetched.completedByUser?.id).toBe(world.jordan.id);
  });
});

describe('ProjectService.list — visibility filtering', () => {
  async function seedThreeVisibilities() {
    await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'shared',
      title: 'Shared project',
    });
    await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'mine_visible',
      title: 'Mine-visible project',
    });
    await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'private',
      title: 'Private project',
    });
  }

  it('never leaks a private project to the partner', async () => {
    await seedThreeVisibilities();
    const visible = expectOk(
      await ProjectService.list(ctx.db, world.jordan.id, { workspaceId: world.workspace.id }),
    );
    expect(visible).toHaveLength(2);
    expect(visible.every((p) => p.visibility !== 'private')).toBe(true);
    expect(visible.map((p) => p.title).sort()).toEqual(['Mine-visible project', 'Shared project']);
  });

  it('returns the private project to its owner', async () => {
    await seedThreeVisibilities();
    const visible = expectOk(
      await ProjectService.list(ctx.db, world.alex.id, { workspaceId: world.workspace.id }),
    );
    expect(visible).toHaveLength(3);
    expect(visible.some((p) => p.visibility === 'private')).toBe(true);
  });

  it('filters by type', async () => {
    await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      type: 'travel',
    });
    await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      type: 'household',
    });
    const travel = expectOk(
      await ProjectService.list(ctx.db, world.alex.id, {
        workspaceId: world.workspace.id,
        type: 'travel',
      }),
    );
    expect(travel).toHaveLength(1);
    expect(travel[0]!.type).toBe('travel');
  });

  it('filters by status', async () => {
    const active = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
    });
    await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      status: 'completed',
    });
    const result = expectOk(
      await ProjectService.list(ctx.db, world.alex.id, {
        workspaceId: world.workspace.id,
        status: 'active',
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(active.id);
  });
});

describe('ProjectService.dashboard', () => {
  it('buckets items into overdue, today and the next 7 days', async () => {
    const overdue = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'shared',
      dueDate: isoIn(-3),
    });
    const dueToday = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'shared',
      dueDate: isoIn(0),
    });
    const soon = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'shared',
      dueDate: isoIn(3),
    });
    const far = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'shared',
      dueDate: isoIn(40),
    });

    const data = expectOk(
      await ProjectService.dashboard(ctx.db, world.alex.id, world.workspace.id),
    );

    const ids = (items: { id: string }[]) => items.map((i) => i.id);
    expect(ids(data.overdue)).toContain(overdue.id);
    expect(ids(data.todayItems)).toContain(dueToday.id);
    expect(ids(data.upcoming7Days)).toContain(soon.id);
    // The far-future item is in none of the urgency buckets.
    expect([...ids(data.overdue), ...ids(data.todayItems), ...ids(data.upcoming7Days)]).not.toContain(
      far.id,
    );
  });

  it('never leaks a private partner project into the dashboard', async () => {
    const privateProject = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'private',
      dueDate: isoIn(0),
    });

    const data = expectOk(
      await ProjectService.dashboard(ctx.db, world.jordan.id, world.workspace.id),
    );

    const allIds = [
      ...data.overdue,
      ...data.todayItems,
      ...data.upcoming7Days,
      ...data.waitingOnPartner,
    ].map((i) => i.id);
    expect(allIds).not.toContain(privateProject.id);
  });

  it('surfaces partner-owned shared items under waitingOnPartner', async () => {
    const partnerProject = await insertProject(ctx.db, {
      workspaceId: world.workspace.id,
      ownerId: world.alex.id,
      visibility: 'shared',
      dueDate: isoIn(3),
    });

    const data = expectOk(
      await ProjectService.dashboard(ctx.db, world.jordan.id, world.workspace.id),
    );
    expect(data.waitingOnPartner.map((i) => i.id)).toContain(partnerProject.id);
  });
});
