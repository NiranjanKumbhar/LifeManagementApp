# Slice D — Calendar (Web) — Design Spec

> **Date:** 2026-06-14
> **Scope:** The `/calendar` screen — a month grid + day agenda aggregating dated
> items (project/task due dates, birthdays/anniversaries, lead-time + custom
> reminders), with the ability to add a reminder on a day. Fourth sub-project of
> the "Web screens beyond Dashboard + Inbox" roadmap item (A=Projects ✅,
> B=Household ✅, C=People ✅).
> **Status:** Approved for planning.

## 1. Goal & Context

The sidebar links to `/calendar`, but the route 404s. This slice delivers a
deadline-aware calendar: a month-at-a-glance grid with per-day markers, and a
selected-day agenda listing that day's items, drawn from everything dated in the
app.

There is **no standalone "event" table** — calendar items are *derived* from
existing entities. There is also **no date-range aggregation endpoint** today (the
dashboard buckets by today/7-days/overdue; task due dates can't be composed
client-side because there's no cross-project task query). So this slice adds:

1. A new **`calendar.list({ workspaceId, from, to })`** aggregation.
2. A small change to **`reminder.create`** to allow a **standalone** reminder
   (no project/task) for the "add a reminder on a day" gesture.

Plus the web screen and a bespoke `CalendarGrid`.

**How reminders work here (context):** a `Reminder` (projectId|taskId nullable,
userId, remindAt, type, severity, message, isSent) is auto-created on project
create as a `lead_time` "Time to start: …" row at `remindAt = startOfDay(
earliestActionDate)` — i.e. *earlier* than the due date, not a duplicate of it.
Reminders are written but **not delivered** (no jobs yet), so the calendar is the
first place they become visible. UI copy must not promise notification.

## 2. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Layout | **Month grid + day agenda** (stacked; grid on top, agenda below) |
| Sources (v1) | **project due, task due, birthday, anniversary, and reminders** (lead-time + custom) |
| Interaction | **Read-only + click-through**, **plus "+ Reminder on this day"** (standalone reminder) |

### Out of scope (deferred)
- External calendar/contacts **sync (Google/Outlook)** — the separate future epic
  (carved out in the People spec).
- Creating projects/tasks/people from the calendar (you create those where they
  live; the calendar links out to them).
- Drag to move dates; week/day/agenda-only view toggles; multi-day/range events.
- Reminder **delivery / notification** (Inngest jobs are a separate roadmap item) —
  this slice only *shows* and *creates* reminder rows.
- Household items on the calendar (no meaningful date).
- Native mobile code (`apps/mobile` is scaffolding) — web only; parity noted in §7.

## 3. Backend

### 3.1 New `calendar.list` aggregation
- Router: `calendar` (new) with `list: workspaceProcedure.input(calendarRangeSchema)`
  → `CalendarService.list(db, userId, { workspaceId, from, to })`.
- Input `calendarRangeSchema`: `{ workspaceId: uuid, from: dateString, to: dateString }`
  (`from`/`to` are `YYYY-MM-DD`, inclusive).
- Returns `CalendarItem[]` aggregating (all **visibility-filtered**):
  - **project_due** — projects in the workspace with `dueDate` in `[from,to]`,
    applying `projectVisibilityCondition(userId)`. `projectId` = the project,
    `personId` = null.
  - **task_due** — tasks with `dueDate` in `[from,to]` whose project is visible
    (join `tasks → projects`, apply the same visibility condition; exclude
    `cancelled`). `projectId` = the parent project.
  - **birthday / anniversary** — people in the workspace whose annual occurrence of
    `birthday` / `anniversary` falls in `[from,to]`. The window is ~6 weeks, so
    match on month-day landing in range (handle a range that crosses a year
    boundary). `personId` = the person; `date` = the occurrence date in range.
  - **reminder** — the current user's reminders (`reminders.userId = userId`) with
    `remindAt` in `[from,to]`, `isSent = false`. `projectId` = the reminder's
    `projectId` (may be null). `title` = the reminder `message` (fallback "Reminder").
- The service returns a flat array; ordering is by `date` then `kind` (the client
  groups by day anyway).

### 3.2 `reminder.create` — allow standalone reminders
- `createReminderSchema`: **drop** the `.refine(projectId || taskId)` so a reminder
  with neither is valid (keep `remindAt`, optional `type`/`severity`/`message`).
- `ReminderService.create`: when both `projectId` and `taskId` are null, **skip**
  the project-authorization step and insert a user-scoped reminder
  (`userId = ctx.userId`). When a project/task *is* given, behavior is unchanged
  (still authorized via `loadReadableProject`).
- No new column — reminders are already user-scoped via `userId`.

### 3.3 Shared types
- Add to `@lifesync/shared-types`:
  ```ts
  export type CalendarItemKind =
    | 'project_due' | 'task_due' | 'birthday' | 'anniversary' | 'reminder';
  export interface CalendarItem {
    id: string;
    date: string;            // YYYY-MM-DD it lands on
    kind: CalendarItemKind;
    title: string;
    projectId: string | null;
    personId: string | null;
  }
  ```

## 4. Web screen

Route `apps/web/src/app/(app)/calendar/page.tsx` (client) + `loading.tsx`,
`calendar.module.css`, `page.test.tsx`.

- **State:** `visibleMonth` (year, month). Derives the grid's `from`/`to` (the first
  through last cell of the 6-week grid, incl. leading/trailing days of adjacent
  months) and fetches `calendar.list({ workspaceId, from, to })`. `selectedDay`
  defaults to today when in the visible month, else the 1st.
- **Header:** `‹ Month YYYY ›` prev/next + a **Today** button (jump to current
  month, select today).
- **`CalendarGrid`** (§5.1) renders the month with per-day markers; selecting a day
  sets `selectedDay`.
- **`DayAgenda`** (§5.2) lists the selected day's items with click-through, and a
  **+ Reminder** button.
- **`ReminderQuickAdd`** (§5.3) creates a standalone reminder on the selected day.

## 5. Components (web-local, `apps/web/src/components/calendar/`)

### 5.1 `CalendarGrid`
- A 7-column month grid (`role="grid"`), Monday-first weeks, 6 rows. Props:
  `month: { year; month }`, `itemsByDay: Map<string, CalendarItem[]>`,
  `selectedDay: string`, `today: string`, `onSelectDay(day: string)`.
- Each cell: the day number; out-of-month days dimmed; `today` highlighted;
  `selectedDay` marked (`aria-selected`). **Markers:** up to 3 kind-colored dots +
  a `+N` overflow when a day has more. Keyboard-navigable (arrow keys), each cell a
  focusable button. Presentational — no data fetching.

### 5.2 `DayAgenda`
- Lists the selected day's `CalendarItem[]` as rows: kind icon + title, rendered as
  a `Link` to the click-through target when one exists (per §6), else a plain row.
  Empty → "Nothing on this day." Header shows the formatted date and a **+ Reminder**
  button.

### 5.3 `ReminderQuickAdd`
- A `Modal` (reuse `@lifesync/ui`): a message `Input` + the fixed selected date shown
  read-only. Submit → `reminder.create({ remindAt: <selected day, ISO datetime>,
  message, type: 'standard' })` → invalidate `calendar.list` + success Toast + close.
  No "you'll be notified" copy.

### 5.4 Metadata + date util
- `apps/web/src/lib/calendar/kind-meta.ts` — `CALENDAR_KIND_META: Record<
  CalendarItemKind, { label; icon; tone }>` (icon + token tone), driving grid dots
  and agenda rows.
- `apps/web/src/lib/calendar/grid.ts` — `monthGridDays(year, month)` → the ordered
  list of `YYYY-MM-DD` for the 6-week grid (Monday-first), and helpers for
  prev/next month. Pure; unit-tested.

**Reused from `@lifesync/ui`:** `Modal`, `Input`, `Button`, `EmptyState`,
`LoadingSpinner`, `useToast`, `formatShortDate`.

## 6. Click-through

Per `CalendarItem.kind`:
- `project_due` / `task_due` → `/projects/[projectId]`.
- `reminder` → `/projects/[projectId]` when `projectId` is set; otherwise a
  non-navigating row (standalone reminders have no target).
- `birthday` / `anniversary` → `/people/[personId]`.

## 7. Data flow, states & mobile

- tRPC + React Query: one `calendar.list` query per visible month (`enabled` when
  workspace present); React Query caches per `from/to` so revisiting months is
  instant. The page memoizes the flat list into a `Map<YYYY-MM-DD, CalendarItem[]>`
  feeding grid + agenda.
- `reminder.create` `onSuccess` → invalidate `calendar.list` (Toast); the reminder
  appears on its day.
- `CalendarItem.date` is already `YYYY-MM-DD` — no client tz math.
- **States:** loading → `LoadingSpinner` (+ `loading.tsx`); query error →
  `EmptyState`; a month with no items still renders the grid; empty day →
  "Nothing on this day."
- **Mobile:** grid + agenda stack (grid on top); day cells meet 44px targets;
  markers are dots (never chips) so narrow cells don't overflow; month nav is
  thumb-reachable. Parity noted for the future native calendar; web only this slice.

## 8. Testing

- **API (integration):** `calendar.list` over a known range returns a project due
  date, a task due date, a birthday whose annual occurrence lands in range, and a
  reminder — and **hides** a private project's due date (and its tasks) from a
  non-owner. `reminder.create` accepts a **standalone** reminder (no project/task)
  and still authorizes project-scoped ones.
- **Unit:** `monthGridDays` (correct 6-week span incl. leading/trailing days,
  Monday-first); the birthday-in-range matcher (incl. a year-boundary window).
- **Web (Vitest + RTL):** the grid renders the month and marks days that have items;
  selecting a day shows its agenda; `+ Reminder` submits `reminder.create` with the
  selected date; a birthday agenda item links to `/people/[id]`.
- No Playwright (consistent with the repo).

## 9. File-level change summary

**New (API):**
- `apps/api/src/services/calendar.service.ts` (+ its query logic) and
  `apps/api/src/routers/calendar.ts`; register in the root router.
- `apps/api/src/routers/calendar.test.ts`.

**Changed (API):**
- `apps/api/src/utils/validation.ts` — add `calendarRangeSchema`; drop the
  `.refine` on `createReminderSchema`.
- `apps/api/src/services/reminder.service.ts` — allow standalone create.
- `apps/api/src/routers/reminder.test.ts` (or a focused test) — standalone create.

**Changed (shared-types):** add `CalendarItem` + `CalendarItemKind`.

**New (web):**
- `apps/web/src/app/(app)/calendar/{page.tsx,loading.tsx,calendar.module.css,page.test.tsx}`.
- `apps/web/src/components/calendar/{CalendarGrid,DayAgenda,ReminderQuickAdd}.tsx`
  (+ module css; `CalendarGrid` test).
- `apps/web/src/lib/calendar/{kind-meta.ts,grid.ts}` (+ `grid.test.ts`).

**Changed:** none in DB schema. The `/calendar` sidebar link already exists.
