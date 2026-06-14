# Calendar (Slice D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/calendar` month-grid + day-agenda screen aggregating dated items (project/task due dates, birthdays/anniversaries, reminders), with "add a reminder on a day".

**Architecture:** New `calendar.list({ workspaceId, from, to })` aggregation endpoint + a one-line relaxation of `reminder.create` (allow standalone reminders) + a new `CalendarItem` shared type. Web: a bespoke `CalendarGrid`, `DayAgenda`, `ReminderQuickAdd`, and pure `monthGridDays`/`occurrenceInRange` helpers.

**Tech Stack:** tRPC v11 + Drizzle (api); Next.js 15 client components + tRPC/React Query + `@lifesync/ui` (web); Vitest + RTL + `@testing-library/user-event`; pglite integration tests (api).

**Spec:** `docs/superpowers/specs/2026-06-14-calendar-slice-d-design.md`

**Key reference facts (verified against the codebase):**
- Root router: `apps/api/src/routers/index.ts` — register new routers in `appRouter`.
- `workspaceProcedure` exposes `ctx.userId` + `ctx.db`; membership enforced from `input.workspaceId` (see `project.list`).
- `projectVisibilityCondition(userId)` from `apps/api/src/services/authz.ts` → `or(ne(projects.visibility,'private'), eq(projects.ownerId, userId))`. Usable in joined queries referencing `projects`.
- `projects.dueDate` and `tasks.dueDate` are `date` columns (compare with `YYYY-MM-DD` strings via `gte`/`lte`, indexed). `reminders.remindAt` is a `timestamp`.
- `reminders` are user-scoped (`userId`), no `workspaceId`. `ReminderService.create` already inserts `projectId: input.projectId ?? null` and **skips** project authz when `projectId` is null — so the ONLY blocker to standalone reminders is the `.refine` on `createReminderSchema`.
- Date utils (`apps/api/src/utils/dates.ts`): `toISODateString`, `startOfDay`, `addDays`. `dateStringSchema` + `uuidSchema` in `apps/api/src/utils/validation.ts`.
- API test harness: `createTestDb`, `seedCouple` → `world.workspace/alex/jordan`, `callerFor(db, clerkId)`, `insertUser`. `createProjectInput` factory. tRPC error codes: service `notFound` → `NOT_FOUND`.
- Shared-types output types live in `packages/shared-types/src/api/*` and are re-exported from `src/index.ts` (see `dashboard.ts`).
- Web detail/list patterns + test mocking: see `apps/web/src/app/(app)/people/` (mocks `next/navigation`, `@/lib/hooks/useWorkspaceId`, `@/lib/trpc`, wraps `ToastProvider`). `Avatar`/`Modal`/`Input`/`Button`/`EmptyState`/`LoadingSpinner`/`useToast`/`formatShortDate` from `@lifesync/ui`. `useWorkspaceId` from `@/lib/hooks/useWorkspaceId`.
- `/calendar` sidebar link already exists; the route 404s.

---

## File Structure

**New (shared-types):** `packages/shared-types/src/api/calendar.ts` (+ barrel export).

**New (API):**
- `apps/api/src/utils/calendar-dates.ts` (+ test)
- `apps/api/src/services/calendar.service.ts`
- `apps/api/src/routers/calendar.ts`
- `apps/api/src/routers/calendar.test.ts`
- `apps/api/src/routers/reminder.test.ts`

**Changed (API):** `apps/api/src/utils/validation.ts` (drop `.refine`, add `calendarRangeSchema`); `apps/api/src/routers/index.ts` (register `calendar`).

**New (web):**
- `apps/web/src/lib/calendar/{grid.ts,grid.test.ts,kind-meta.ts}`
- `apps/web/src/components/calendar/{CalendarGrid,DayAgenda,ReminderQuickAdd}.tsx` (+ module css; `CalendarGrid.test.tsx`, `DayAgenda.test.tsx`, `ReminderQuickAdd.test.tsx`)
- `apps/web/src/app/(app)/calendar/{page.tsx,loading.tsx,calendar.module.css,page.test.tsx}`

**No DB schema changes.**

---

## Task 1: Shared type `CalendarItem`

**Files:**
- Create: `packages/shared-types/src/api/calendar.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: Create the type**

`packages/shared-types/src/api/calendar.ts`:

```ts
export type CalendarItemKind =
  | 'project_due'
  | 'task_due'
  | 'birthday'
  | 'anniversary'
  | 'reminder';

export interface CalendarItem {
  /** Source row id (people items use `${personId}:birthday|anniversary`). */
  id: string;
  /** The day it lands on, YYYY-MM-DD. */
  date: string;
  kind: CalendarItemKind;
  title: string;
  /** Click-through target for project_due / task_due / reminder. */
  projectId: string | null;
  /** Click-through target for birthday / anniversary. */
  personId: string | null;
}
```

- [ ] **Step 2: Export from the barrel**

In `packages/shared-types/src/index.ts`, add alongside the other `api/*` exports (near the `DashboardData` export):

```ts
export type { CalendarItem, CalendarItemKind } from './api/calendar';
```

- [ ] **Step 3: Build the package**

Run: `pnpm --filter @lifesync/shared-types build`
Expected: clean (tsc).

- [ ] **Step 4: Commit**

```bash
git add packages/shared-types/src/api/calendar.ts packages/shared-types/src/index.ts
git commit -m "feat(types): add CalendarItem for the calendar aggregation"
```

---

## Task 2: Allow standalone reminders

**Files:**
- Modify: `apps/api/src/utils/validation.ts`
- Test: `apps/api/src/routers/reminder.test.ts` (new)

`ReminderService.create` already handles a null project — only the schema's `.refine` blocks a standalone reminder. Drop it.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/routers/reminder.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';

let ctx: TestDb;
let world: SeededCouple;

beforeEach(async () => {
  ctx = await createTestDb();
  world = await seedCouple(ctx.db);
});
afterEach(async () => {
  await ctx.close();
});

describe('reminderRouter.create (standalone)', () => {
  it('creates a reminder with no project or task', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const reminder = await alex.reminder.create({
      remindAt: new Date('2026-07-02T09:00:00.000Z').toISOString(),
      message: 'Call the dentist',
    });
    expect(reminder.projectId).toBeNull();
    expect(reminder.taskId).toBeNull();
    expect(reminder.message).toBe('Call the dentist');

    const list = await alex.reminder.list({});
    expect(list.map((r) => r.id)).toContain(reminder.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- reminder`
Expected: FAIL — Zod refine rejects (`Either projectId or taskId is required`).

- [ ] **Step 3: Drop the refine**

In `apps/api/src/utils/validation.ts`, change `createReminderSchema` from:

```ts
export const createReminderSchema = z
  .object({
    projectId: uuidSchema.optional(),
    taskId: uuidSchema.optional(),
    remindAt: z.string().datetime(),
    type: z.enum(['standard', 'lead_time', 'escalation', 'recurring']).optional(),
    severity: z.enum(['info', 'warning', 'urgent', 'critical']).optional(),
    message: z.string().max(1000).optional(),
  })
  .refine((d) => Boolean(d.projectId) || Boolean(d.taskId), {
    message: 'Either projectId or taskId is required',
  });
```
to (drop the `.refine`):

```ts
export const createReminderSchema = z.object({
  projectId: uuidSchema.optional(),
  taskId: uuidSchema.optional(),
  remindAt: z.string().datetime(),
  type: z.enum(['standard', 'lead_time', 'escalation', 'recurring']).optional(),
  severity: z.enum(['info', 'warning', 'urgent', 'critical']).optional(),
  message: z.string().max(1000).optional(),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- reminder`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/utils/validation.ts apps/api/src/routers/reminder.test.ts
git commit -m "feat(api): allow standalone reminders (no project/task required)"
```

---

## Task 3: `occurrenceInRange` date util (API)

**Files:**
- Create: `apps/api/src/utils/calendar-dates.ts`
- Test: `apps/api/src/utils/calendar-dates.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/src/utils/calendar-dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { occurrenceInRange } from './calendar-dates';

describe('occurrenceInRange', () => {
  it('returns the occurrence date when the annual day lands in range', () => {
    expect(occurrenceInRange('1990-07-14', '2026-07-01', '2026-07-31')).toBe('2026-07-14');
  });

  it('returns null when the day is outside the range', () => {
    expect(occurrenceInRange('1990-03-02', '2026-07-01', '2026-07-31')).toBeNull();
  });

  it('handles a window that crosses a year boundary', () => {
    // Late-Dec → early-Jan grid window; a 2 Jan birthday should match in the next year.
    expect(occurrenceInRange('1988-01-02', '2026-12-28', '2027-01-07')).toBe('2027-01-02');
  });

  it('includes the range endpoints', () => {
    expect(occurrenceInRange('1990-07-31', '2026-07-01', '2026-07-31')).toBe('2026-07-31');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- calendar-dates`
Expected: FAIL — cannot resolve `./calendar-dates`.

- [ ] **Step 3: Write the util**

`apps/api/src/utils/calendar-dates.ts`:

```ts
/**
 * The occurrence of an annual date (from a YYYY-MM-DD birthday/anniversary) that
 * falls within [from, to] inclusive, as YYYY-MM-DD — or null if none does. The
 * window is short (a calendar grid), but may span a year boundary, so both the
 * `from` year and the `to` year are considered. Lexicographic comparison is valid
 * for zero-padded YYYY-MM-DD strings.
 */
export function occurrenceInRange(iso: string, from: string, to: string): string | null {
  const [, month, day] = iso.split('-');
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));
  for (let year = fromYear; year <= toYear; year++) {
    const candidate = `${String(year).padStart(4, '0')}-${month}-${day}`;
    if (candidate >= from && candidate <= to) return candidate;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter api test -- calendar-dates`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/utils/calendar-dates.ts apps/api/src/utils/calendar-dates.test.ts
git commit -m "feat(api): add occurrenceInRange for recurring calendar dates"
```

---

## Task 4: `calendar` service + router

**Files:**
- Modify: `apps/api/src/utils/validation.ts` (add `calendarRangeSchema`)
- Create: `apps/api/src/services/calendar.service.ts`
- Create: `apps/api/src/routers/calendar.ts`
- Modify: `apps/api/src/routers/index.ts`
- Test: `apps/api/src/routers/calendar.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/src/routers/calendar.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';
import { createProjectInput } from '../__tests__/factories/project.factory';

let ctx: TestDb;
let world: SeededCouple;

beforeEach(async () => {
  ctx = await createTestDb();
  world = await seedCouple(ctx.db);
});
afterEach(async () => {
  await ctx.close();
});

const RANGE = { from: '2026-07-01', to: '2026-07-31' };

describe('calendarRouter.list', () => {
  it('aggregates project due dates, task due dates, birthdays, and reminders in range', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Passport', dueDate: '2026-07-20' }),
    );
    await alex.task.create({ projectId: project.id, title: 'Book appointment', dueDate: '2026-07-10' });
    await alex.person.create({ workspaceId: world.workspace.id, name: 'Mum', birthday: '1960-07-14' });
    await alex.reminder.create({
      remindAt: new Date('2026-07-02T09:00:00.000Z').toISOString(),
      message: 'Start passport',
    });

    const items = await alex.calendar.list({ workspaceId: world.workspace.id, ...RANGE });
    const kinds = items.map((i) => i.kind);
    expect(kinds).toContain('project_due');
    expect(kinds).toContain('task_due');
    expect(kinds).toContain('birthday');
    expect(kinds).toContain('reminder');
    expect(items.find((i) => i.kind === 'birthday')?.date).toBe('2026-07-14');
    expect(items.find((i) => i.kind === 'project_due')?.date).toBe('2026-07-20');
  });

  it("hides a private project's due date from a non-owner", async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.project.create(
      createProjectInput({
        workspaceId: world.workspace.id,
        title: 'Secret',
        dueDate: '2026-07-15',
        visibility: 'private',
      }),
    );
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const items = await jordan.calendar.list({ workspaceId: world.workspace.id, ...RANGE });
    expect(items.find((i) => i.title === 'Secret')).toBeUndefined();
  });
});
```

> If `createProjectInput` doesn't accept `dueDate`/`visibility` overrides, pass them through the object literal (it spreads overrides) — confirm by reading `apps/api/src/__tests__/factories/project.factory.ts` and adjust the call if the field name differs.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- calendar.test`
Expected: FAIL — `caller.calendar` is undefined.

- [ ] **Step 3: Add `calendarRangeSchema`**

In `apps/api/src/utils/validation.ts`, add (near the other schemas; `uuidSchema` and `dateStringSchema` already exist):

```ts
export const calendarRangeSchema = z.object({
  workspaceId: uuidSchema,
  from: dateStringSchema,
  to: dateStringSchema,
});
```

- [ ] **Step 4: Write the service**

`apps/api/src/services/calendar.service.ts`:

```ts
import { and, eq, gte, isNotNull, lt, lte, ne } from 'drizzle-orm';
import type { z } from 'zod';
import type { CalendarItem } from '@lifesync/shared-types';
import type { Database } from '../db/client';
import { people, projects, reminders, tasks } from '../db/schema';
import { ok, type AppError, type Result } from '../utils/errors';
import { projectVisibilityCondition } from './authz';
import { occurrenceInRange } from '../utils/calendar-dates';
import { toISODateString } from '../utils/dates';
import type { calendarRangeSchema } from '../utils/validation';

type RangeInput = z.infer<typeof calendarRangeSchema>;

export class CalendarService {
  static async list(
    db: Database,
    userId: string,
    input: RangeInput,
  ): Promise<Result<CalendarItem[], AppError>> {
    const { workspaceId, from, to } = input;
    const items: CalendarItem[] = [];

    // Project due dates (visible, non-archived).
    const projectRows = await db
      .select({ id: projects.id, title: projects.title, dueDate: projects.dueDate })
      .from(projects)
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          ne(projects.status, 'archived'),
          isNotNull(projects.dueDate),
          gte(projects.dueDate, from),
          lte(projects.dueDate, to),
          projectVisibilityCondition(userId),
        ),
      );
    for (const p of projectRows) {
      items.push({ id: p.id, date: p.dueDate as string, kind: 'project_due', title: p.title, projectId: p.id, personId: null });
    }

    // Task due dates (via a visible project, not cancelled).
    const taskRows = await db
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate, projectId: tasks.projectId })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          ne(tasks.status, 'cancelled'),
          isNotNull(tasks.dueDate),
          gte(tasks.dueDate, from),
          lte(tasks.dueDate, to),
          projectVisibilityCondition(userId),
        ),
      );
    for (const t of taskRows) {
      items.push({ id: t.id, date: t.dueDate as string, kind: 'task_due', title: t.title, projectId: t.projectId, personId: null });
    }

    // Birthdays / anniversaries (recurring annual).
    const peopleRows = await db
      .select({ id: people.id, name: people.name, birthday: people.birthday, anniversary: people.anniversary })
      .from(people)
      .where(eq(people.workspaceId, workspaceId));
    for (const person of peopleRows) {
      const bd = person.birthday ? occurrenceInRange(person.birthday, from, to) : null;
      if (bd) items.push({ id: `${person.id}:birthday`, date: bd, kind: 'birthday', title: person.name, projectId: null, personId: person.id });
      const an = person.anniversary ? occurrenceInRange(person.anniversary, from, to) : null;
      if (an) items.push({ id: `${person.id}:anniversary`, date: an, kind: 'anniversary', title: person.name, projectId: null, personId: person.id });
    }

    // Reminders (current user's, unsent, in range).
    const fromDate = new Date(`${from}T00:00:00`);
    const toExclusive = new Date(`${to}T00:00:00`);
    toExclusive.setDate(toExclusive.getDate() + 1);
    const reminderRows = await db
      .select({ id: reminders.id, message: reminders.message, remindAt: reminders.remindAt, projectId: reminders.projectId })
      .from(reminders)
      .where(
        and(
          eq(reminders.userId, userId),
          eq(reminders.isSent, false),
          gte(reminders.remindAt, fromDate),
          lt(reminders.remindAt, toExclusive),
        ),
      );
    for (const r of reminderRows) {
      items.push({ id: r.id, date: toISODateString(r.remindAt), kind: 'reminder', title: r.message ?? 'Reminder', projectId: r.projectId, personId: null });
    }

    items.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.kind.localeCompare(b.kind)));
    return ok(items);
  }
}
```

- [ ] **Step 5: Write the router and register it**

`apps/api/src/routers/calendar.ts`:

```ts
import { router, unwrap } from '../trpc';
import { workspaceProcedure } from '../middleware/workspace';
import { CalendarService } from '../services/calendar.service';
import { calendarRangeSchema } from '../utils/validation';

export const calendarRouter = router({
  list: workspaceProcedure.input(calendarRangeSchema).query(async ({ ctx, input }) => {
    return unwrap(await CalendarService.list(ctx.db, ctx.userId, input));
  }),
});
```

In `apps/api/src/routers/index.ts`, import and register:

```ts
import { calendarRouter } from './calendar';
```
and add `calendar: calendarRouter,` inside `appRouter({ ... })` (e.g. after `inbox`).

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm --filter api test -- calendar.test`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/calendar.service.ts apps/api/src/routers/calendar.ts apps/api/src/routers/index.ts apps/api/src/utils/validation.ts apps/api/src/routers/calendar.test.ts
git commit -m "feat(api): add calendar.list aggregation (due dates, occasions, reminders)"
```

---

## Task 5: Web calendar utils (`monthGridDays`, `kind-meta`)

**Files:**
- Create: `apps/web/src/lib/calendar/grid.ts`
- Test: `apps/web/src/lib/calendar/grid.test.ts`
- Create: `apps/web/src/lib/calendar/kind-meta.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/calendar/grid.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { monthGridDays, isoDay } from './grid';

describe('monthGridDays', () => {
  it('returns a 6-week (42-day) Monday-first grid covering the month', () => {
    const days = monthGridDays(2026, 6); // June 2026 (1-based month)
    expect(days).toHaveLength(42);
    // Monday-first: the first cell is a Monday on/just before 1 Jun 2026.
    expect(new Date(`${days[0]}T00:00:00`).getDay()).toBe(1); // Monday
    expect(days).toContain('2026-06-01');
    expect(days).toContain('2026-06-30');
    // Days are sorted and contiguous.
    expect(days[41] > days[0]).toBe(true);
  });
});

describe('isoDay', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(isoDay(new Date(2026, 5, 9))).toBe('2026-06-09');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- calendar/grid`
Expected: FAIL — cannot resolve `./grid`.

- [ ] **Step 3: Write the utils**

`apps/web/src/lib/calendar/grid.ts`:

```ts
/** A local Date as YYYY-MM-DD (no timezone shift). */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The 42 days (6 Monday-first weeks) of the grid that contains `month`
 * (1-based), as YYYY-MM-DD, including leading/trailing days of adjacent months.
 */
export function monthGridDays(year: number, month: number): string[] {
  const first = new Date(year, month - 1, 1);
  const mondayOffset = (first.getDay() + 6) % 7; // 0=Mon … 6=Sun
  const start = new Date(year, month - 1, 1 - mondayOffset);
  const days: string[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(isoDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  }
  return days;
}

/** Step a 1-based {year, month} by ±1 month. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
```

`apps/web/src/lib/calendar/kind-meta.ts`:

```ts
import type { CalendarItemKind } from '@lifesync/shared-types';

export const CALENDAR_KIND_META: Record<CalendarItemKind, { label: string; icon: string; tone: string }> = {
  project_due: { label: 'Project due', icon: '📁', tone: 'var(--ls-primary-600)' },
  task_due: { label: 'Task due', icon: '✓', tone: 'var(--ls-primary-400)' },
  birthday: { label: 'Birthday', icon: '🎂', tone: 'var(--ls-urgency-soon)' },
  anniversary: { label: 'Anniversary', icon: '💗', tone: 'var(--ls-urgency-overdue)' },
  reminder: { label: 'Reminder', icon: '⏰', tone: 'var(--ls-text-tertiary)' },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- calendar/grid`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/calendar
git commit -m "feat(web): add calendar grid + kind metadata utils"
```

---

## Task 6: `CalendarGrid` component

**Files:**
- Create: `apps/web/src/components/calendar/CalendarGrid.tsx` (+ `.module.css`)
- Test: `apps/web/src/components/calendar/CalendarGrid.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/calendar/CalendarGrid.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CalendarItem } from '@lifesync/shared-types';
import { CalendarGrid } from './CalendarGrid';

const item: CalendarItem = {
  id: 'p1', date: '2026-06-18', kind: 'project_due', title: 'Passport', projectId: 'p1', personId: null,
};
const itemsByDay = new Map<string, CalendarItem[]>([['2026-06-18', [item]]]);

describe('CalendarGrid', () => {
  it('renders the month days and marks days that have items', () => {
    render(
      <CalendarGrid
        month={{ year: 2026, month: 6 }}
        itemsByDay={itemsByDay}
        selectedDay="2026-06-18"
        today="2026-06-14"
        onSelectDay={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: /18 June.*1 item/i })).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('calls onSelectDay when a day is clicked', async () => {
    const onSelectDay = vi.fn();
    render(
      <CalendarGrid
        month={{ year: 2026, month: 6 }}
        itemsByDay={itemsByDay}
        selectedDay="2026-06-18"
        today="2026-06-14"
        onSelectDay={onSelectDay}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /^9 June/i }));
    expect(onSelectDay).toHaveBeenCalledWith('2026-06-09');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- CalendarGrid`
Expected: FAIL — cannot resolve `./CalendarGrid`.

- [ ] **Step 3: Write the component**

`apps/web/src/components/calendar/CalendarGrid.tsx`:

```tsx
'use client';

import type { CalendarItem } from '@lifesync/shared-types';
import { cn } from '@lifesync/ui';
import { monthGridDays } from '@/lib/calendar/grid';
import { CALENDAR_KIND_META } from '@/lib/calendar/kind-meta';
import styles from './CalendarGrid.module.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface CalendarGridProps {
  month: { year: number; month: number };
  itemsByDay: Map<string, CalendarItem[]>;
  selectedDay: string;
  today: string;
  onSelectDay: (day: string) => void;
}

export function CalendarGrid({ month, itemsByDay, selectedDay, today, onSelectDay }: CalendarGridProps) {
  const days = monthGridDays(month.year, month.month);

  return (
    <div className={styles.grid} role="grid" aria-label="Calendar">
      <div className={styles.weekrow} role="row">
        {WEEKDAYS.map((w) => (
          <span key={w} className={styles.weekday} role="columnheader">
            {w}
          </span>
        ))}
      </div>
      <div className={styles.cells}>
        {days.map((day) => {
          const [y, m, d] = day.split('-').map(Number);
          const inMonth = m === month.month && y === month.year;
          const items = itemsByDay.get(day) ?? [];
          const isToday = day === today;
          const isSelected = day === selectedDay;
          const dayNum = d;
          const label =
            `${dayNum} ${MONTHS[m - 1]}` + (items.length ? `, ${items.length} item${items.length > 1 ? 's' : ''}` : '');
          return (
            <button
              key={day}
              type="button"
              role="gridcell"
              aria-selected={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={label}
              className={cn(
                styles.cell,
                !inMonth && styles.outside,
                isToday && styles.today,
                isSelected && styles.selected,
              )}
              onClick={() => onSelectDay(day)}
            >
              <span className={styles.num}>{dayNum}</span>
              {items.length > 0 ? (
                <span className={styles.dots} aria-hidden="true">
                  {items.slice(0, 3).map((it, i) => (
                    <span
                      key={i}
                      className={styles.dot}
                      style={{ background: CALENDAR_KIND_META[it.kind].tone }}
                    />
                  ))}
                  {items.length > 3 ? <span className={styles.more}>+{items.length - 3}</span> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

`apps/web/src/components/calendar/CalendarGrid.module.css`:

```css
.grid {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.weekrow,
.cells {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.25rem;
}

.weekday {
  text-align: center;
  font-size: var(--ls-text-xs);
  font-weight: 600;
  color: var(--ls-text-tertiary);
  padding: 0.25rem 0;
}

.cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  min-height: 3rem;
  padding: 0.35rem 0.2rem;
  border: 1px solid transparent;
  border-radius: var(--ls-radius-md);
  background: var(--ls-surface-card);
  color: var(--ls-text-primary);
  font: inherit;
  cursor: pointer;
}

.cell:hover {
  background: var(--ls-surface-sunken);
}

.cell:focus-visible {
  outline: 2px solid var(--ls-primary-600);
  outline-offset: 1px;
}

.outside {
  color: var(--ls-text-tertiary);
  background: transparent;
}

.today .num {
  background: var(--ls-primary-600);
  color: var(--ls-text-inverse);
  border-radius: var(--ls-radius-full);
  width: 1.5rem;
  height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.selected {
  border-color: var(--ls-primary-600);
}

.num {
  font-size: var(--ls-text-sm);
}

.dots {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: var(--ls-radius-full);
}

.more {
  font-size: 0.6rem;
  color: var(--ls-text-tertiary);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- CalendarGrid`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/calendar/CalendarGrid.tsx apps/web/src/components/calendar/CalendarGrid.module.css apps/web/src/components/calendar/CalendarGrid.test.tsx
git commit -m "feat(web): add CalendarGrid month component"
```

---

## Task 7: `DayAgenda` + `ReminderQuickAdd`

**Files:**
- Create: `apps/web/src/components/calendar/DayAgenda.tsx` (+ `.module.css`)
- Create: `apps/web/src/components/calendar/ReminderQuickAdd.tsx`
- Test: `apps/web/src/components/calendar/DayAgenda.test.tsx`, `apps/web/src/components/calendar/ReminderQuickAdd.test.tsx`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/components/calendar/DayAgenda.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CalendarItem } from '@lifesync/shared-types';
import { DayAgenda } from './DayAgenda';

const items: CalendarItem[] = [
  { id: 'm:birthday', date: '2026-06-18', kind: 'birthday', title: 'Mum', projectId: null, personId: 'm' },
  { id: 'p1', date: '2026-06-18', kind: 'project_due', title: 'Passport', projectId: 'p1', personId: null },
];

describe('DayAgenda', () => {
  it('lists the day items and links them to their source', () => {
    render(<DayAgenda day="2026-06-18" items={items} onAddReminder={() => {}} />);
    expect(screen.getByText('Mum')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mum/ })).toHaveAttribute('href', '/people/m');
    expect(screen.getByRole('link', { name: /Passport/ })).toHaveAttribute('href', '/projects/p1');
  });

  it('shows an empty message and an add-reminder button', async () => {
    const onAddReminder = vi.fn();
    render(<DayAgenda day="2026-06-18" items={[]} onAddReminder={onAddReminder} />);
    expect(screen.getByText(/Nothing on this day/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Reminder/i }));
    expect(onAddReminder).toHaveBeenCalled();
  });
});
```

`apps/web/src/components/calendar/ReminderQuickAdd.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const createMutate = vi.fn();
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ calendar: { list: { invalidate: vi.fn() } } }),
    reminder: { create: { useMutation: (o: { onSuccess?: () => void }) => ({ mutate: (v: unknown) => { createMutate(v); o.onSuccess?.(); }, isPending: false }) } },
  },
}));

import { ReminderQuickAdd } from './ReminderQuickAdd';

describe('ReminderQuickAdd', () => {
  it('creates a reminder on the given day', async () => {
    render(
      <ToastProvider>
        <ReminderQuickAdd isOpen day="2026-06-18" onClose={() => {}} />
      </ToastProvider>,
    );
    await userEvent.type(screen.getByLabelText(/Reminder/i), 'Call plumber');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Call plumber', type: 'standard' }),
    );
    const arg = createMutate.mock.calls[0][0] as { remindAt: string };
    expect(arg.remindAt.startsWith('2026-06-18')).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter web test -- DayAgenda ReminderQuickAdd`
Expected: FAIL — modules unresolved.

- [ ] **Step 3: Write `DayAgenda`**

`apps/web/src/components/calendar/DayAgenda.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { CalendarItem } from '@lifesync/shared-types';
import { Button, formatShortDate } from '@lifesync/ui';
import { CALENDAR_KIND_META } from '@/lib/calendar/kind-meta';
import styles from './DayAgenda.module.css';

export interface DayAgendaProps {
  day: string;
  items: CalendarItem[];
  onAddReminder: () => void;
}

function hrefFor(item: CalendarItem): string | null {
  if (item.kind === 'birthday' || item.kind === 'anniversary') {
    return item.personId ? `/people/${item.personId}` : null;
  }
  return item.projectId ? `/projects/${item.projectId}` : null;
}

export function DayAgenda({ day, items, onAddReminder }: DayAgendaProps) {
  return (
    <section className={styles.agenda} aria-label="Day agenda">
      <header className={styles.head}>
        <h2 className={styles.date}>{formatShortDate(day)}</h2>
        <Button size="sm" variant="ghost" onClick={onAddReminder}>
          + Reminder
        </Button>
      </header>

      {items.length === 0 ? (
        <p className={styles.empty}>Nothing on this day.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => {
            const meta = CALENDAR_KIND_META[item.kind];
            const href = hrefFor(item);
            const body = (
              <>
                <span className={styles.icon} aria-hidden="true">
                  {meta.icon}
                </span>
                <span className={styles.title}>{item.title}</span>
                <span className={styles.kind}>{meta.label}</span>
              </>
            );
            return (
              <li key={item.id} className={styles.row}>
                {href ? (
                  <Link href={href} className={styles.link}>
                    {body}
                  </Link>
                ) : (
                  <span className={styles.link}>{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

`apps/web/src/components/calendar/DayAgenda.module.css`:

```css
.agenda {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.date {
  margin: 0;
  font-size: var(--ls-text-base);
  font-weight: 600;
  color: var(--ls-text-primary);
}

.empty {
  margin: 0;
  color: var(--ls-text-tertiary);
  font-size: var(--ls-text-sm);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.link {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.4rem;
  border-radius: var(--ls-radius-md);
  text-decoration: none;
  color: inherit;
}

a.link:hover {
  background: var(--ls-surface-sunken);
}

.title {
  flex: 1 1 auto;
  color: var(--ls-text-primary);
}

.kind {
  font-size: var(--ls-text-xs);
  color: var(--ls-text-tertiary);
}
```

- [ ] **Step 4: Write `ReminderQuickAdd`**

`apps/web/src/components/calendar/ReminderQuickAdd.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button, Input, Modal, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';

export interface ReminderQuickAddProps {
  isOpen: boolean;
  day: string; // YYYY-MM-DD
  onClose: () => void;
}

export function ReminderQuickAdd({ isOpen, day, onClose }: ReminderQuickAddProps) {
  const [message, setMessage] = useState('');
  const toast = useToast();
  const utils = trpc.useUtils();

  const create = trpc.reminder.create.useMutation({
    onSuccess: () => {
      void utils.calendar.list.invalidate();
      toast.success('Reminder added');
      setMessage('');
      onClose();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const submit = () => {
    if (!message.trim() || create.isPending) return;
    // Noon avoids any local/UTC day-shift when the row maps back to a calendar day.
    create.mutate({ remindAt: `${day}T12:00:00.000Z`, message: message.trim(), type: 'standard' });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add a reminder"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!message.trim() || create.isPending}>
            {create.isPending ? 'Saving…' : 'Add'}
          </Button>
        </>
      }
    >
      <Input label={`Reminder for ${day}`} value={message} onChange={setMessage} required />
    </Modal>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter web test -- DayAgenda ReminderQuickAdd`
Expected: PASS (DayAgenda 2, ReminderQuickAdd 1).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/calendar/DayAgenda.tsx apps/web/src/components/calendar/DayAgenda.module.css apps/web/src/components/calendar/DayAgenda.test.tsx apps/web/src/components/calendar/ReminderQuickAdd.tsx apps/web/src/components/calendar/ReminderQuickAdd.test.tsx
git commit -m "feat(web): add DayAgenda and ReminderQuickAdd"
```

---

## Task 8: `/calendar` page

**Files:**
- Create: `apps/web/src/app/(app)/calendar/page.tsx` (+ `loading.tsx`, `calendar.module.css`)
- Test: `apps/web/src/app/(app)/calendar/page.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/src/app/(app)/calendar/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@lifesync/ui';

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ calendar: { list: { invalidate: vi.fn() } } }),
    calendar: {
      list: {
        useQuery: () => ({
          isLoading: false,
          isError: false,
          data: [
            { id: 'p1', date: '2026-06-18', kind: 'project_due', title: 'Passport', projectId: 'p1', personId: null },
          ],
        }),
      },
    },
    reminder: { create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
  },
}));

import CalendarPage from './page';

function renderPage() {
  return render(
    <ToastProvider>
      <CalendarPage />
    </ToastProvider>,
  );
}

describe('CalendarPage', () => {
  it('renders a month grid and the calendar heading', () => {
    renderPage();
    expect(screen.getByRole('grid', { name: 'Calendar' })).toBeInTheDocument();
    // The marked day (18th) exposes its item count in its accessible label.
    expect(screen.getByRole('button', { name: /18 June.*1 item/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- calendar/page`
Expected: FAIL — cannot resolve `./page`.

- [ ] **Step 3: Write the page**

`apps/web/src/app/(app)/calendar/page.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import type { CalendarItem } from '@lifesync/shared-types';
import { Button, EmptyState, LoadingSpinner } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { DayAgenda } from '@/components/calendar/DayAgenda';
import { ReminderQuickAdd } from '@/components/calendar/ReminderQuickAdd';
import { monthGridDays, isoDay, shiftMonth } from '@/lib/calendar/grid';
import styles from './calendar.module.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarPage() {
  const workspaceId = useWorkspaceId();
  const enabled = Boolean(workspaceId);
  const todayIso = isoDay(new Date());

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedDay, setSelectedDay] = useState(todayIso);
  const [addingReminder, setAddingReminder] = useState(false);

  const grid = useMemo(() => monthGridDays(month.year, month.month), [month]);
  const from = grid[0];
  const to = grid[grid.length - 1];

  const query = trpc.calendar.list.useQuery(
    { workspaceId: workspaceId ?? '', from, to },
    { enabled },
  );

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of query.data ?? []) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [query.data]);

  const goToday = () => {
    const now = new Date();
    setMonth({ year: now.getFullYear(), month: now.getMonth() + 1 });
    setSelectedDay(isoDay(now));
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.nav}>
          <Button variant="ghost" size="sm" aria-label="Previous month" onClick={() => setMonth((m) => shiftMonth(m.year, m.month, -1))}>
            ‹
          </Button>
          <h1 className={styles.title}>
            {MONTHS[month.month - 1]} {month.year}
          </h1>
          <Button variant="ghost" size="sm" aria-label="Next month" onClick={() => setMonth((m) => shiftMonth(m.year, m.month, 1))}>
            ›
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={goToday}>
          Today
        </Button>
      </header>

      {query.isLoading ? (
        <div className={styles.center}>
          <LoadingSpinner size="lg" label="Loading your calendar" />
        </div>
      ) : query.isError ? (
        <div className={styles.center}>
          <EmptyState title="We couldn't load your calendar" description="Make sure the API is running." />
        </div>
      ) : (
        <>
          <CalendarGrid
            month={month}
            itemsByDay={itemsByDay}
            selectedDay={selectedDay}
            today={todayIso}
            onSelectDay={setSelectedDay}
          />
          <DayAgenda
            day={selectedDay}
            items={itemsByDay.get(selectedDay) ?? []}
            onAddReminder={() => setAddingReminder(true)}
          />
        </>
      )}

      <ReminderQuickAdd isOpen={addingReminder} day={selectedDay} onClose={() => setAddingReminder(false)} />
    </div>
  );
}
```

`apps/web/src/app/(app)/calendar/loading.tsx`:

```tsx
import { LoadingSpinner } from '@lifesync/ui';

export default function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
      <LoadingSpinner size="lg" label="Loading your calendar" />
    </div>
  );
}
```

`apps/web/src/app/(app)/calendar/calendar.module.css`:

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  max-width: 56rem;
  margin: 0 auto;
  width: 100%;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.nav {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.title {
  margin: 0;
  font-family: var(--ls-font-display);
  font-size: 1.4rem;
  color: var(--ls-text-primary);
  min-width: 10rem;
  text-align: center;
}

.center {
  display: flex;
  justify-content: center;
  padding: 3rem 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- calendar/page`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/calendar"
git commit -m "feat(web): add /calendar month + agenda screen"
```

---

## Task 9: Verification & docs

- [ ] **Step 1: Build, typecheck, web lint, full test suite**

Run:
```bash
pnpm --filter @lifesync/shared-types build
pnpm --filter api build
pnpm typecheck
pnpm --filter web lint
pnpm test
```
Expected: typecheck clean; web lint clean; all tests pass. New: api `reminder` (1) + `calendar-dates` (4) + `calendar` (2); web `grid` (2) + `CalendarGrid` (2) + `DayAgenda` (2) + `ReminderQuickAdd` (1) + `calendar/page` (1). (`@lifesync/ui` `Avatar.tsx` lint error is pre-existing on `main` — lint only `web`.)

- [ ] **Step 2: Manual smoke (recommended)**

`pnpm dev --filter=web` (+ `--filter=api`), open `/calendar`:
- The current month renders; days with due dates/birthdays/reminders show dots.
- Prev/next month navigates; Today jumps back and selects today.
- Select a day → its agenda lists items; a birthday links to the person, a due date to the project.
- + Reminder → add a note on the selected day → it appears as a dot + agenda row (no notification promised).
- Resize to mobile width → grid + agenda stack and stay usable.

- [ ] **Step 3: Update CLAUDE.md & the slice memory**

- `CLAUDE.md`: bump the test-count line; add the Calendar screen to the Web "Done ✅" bullet; in "Remaining 🔭" item 1 mark Calendar done (Settings remains); bump the procedure count (calendar.list added; reminder.create now allows standalone) and note `CalendarItem` in shared-types.
- Update the `web-screens-slice-plan` memory: mark Slice D done (commit after merge); note E (Settings) is the last slice.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Calendar (Slice D) complete in status"
```

---

## Self-Review Notes (verified against the spec)

- **§3.1 calendar.list aggregating 4 sources, visibility-filtered** → Task 4 (`CalendarService.list` + `projectVisibilityCondition`; private-project test).
- **§3.2 standalone reminders** → Task 2 (drop `.refine`; service already null-safe).
- **§3.3 CalendarItem/CalendarItemKind** → Task 1.
- **§4 page: month state, from/to from grid, query, selected day, Today/prev/next** → Task 8.
- **§5.1 CalendarGrid (grid, markers, today/selected, keyboard buttons)** → Task 6.
- **§5.2 DayAgenda (rows, click-through, empty, +Reminder)** → Task 7.
- **§5.3 ReminderQuickAdd (standalone create, invalidate, no notify copy)** → Task 7.
- **§5.4 kind-meta + monthGridDays (pure, tested)** → Task 5; `occurrenceInRange` → Task 3.
- **§6 click-through map** → Task 7 (`hrefFor`).
- **§7 data flow, states, mobile stack** → Task 8 + grid/agenda CSS.
- **§8 tests** → Tasks 2–8 (api: standalone reminder, occurrenceInRange, calendar.list + visibility; web: grid math, CalendarGrid, DayAgenda, ReminderQuickAdd, page).
- **Type/name consistency:** `calendar.list({ workspaceId, from, to })`, `CalendarItem{ id,date,kind,title,projectId,personId }`, `monthGridDays(year, month/*1-based*/)`, `reminder.create({ remindAt, message, type })`, `CALENDAR_KIND_META` keyed by `CalendarItemKind`.
