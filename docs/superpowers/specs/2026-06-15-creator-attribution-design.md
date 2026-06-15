# Creator & Completer Attribution — Design

> **Date:** 2026-06-15
> **Status:** Approved (design), pending implementation plan
> **Scope:** Show *who added* and *who completed* shared items (Tasks, Projects, Household, Inbox) across the web app. `apps/api` + `apps/web` + shared packages. The React Native `apps/mobile` app is untouched.

## Problem

In a shared workspace, partners cannot tell who added or completed an item. The data is
inconsistent and the UI never shows it:

- **Captured in the DB today:** `inbox_items.captured_by` ✓, `household_items.added_by` ✓,
  `projects.owner_id` (defaults to creator), and `activity_events` records the actor + action
  (`created`/`updated`/`completed`) for every mutation.
- **Gap in the DB:** `tasks` track only `owner_id` (assignee) + `completed_by` — there is **no
  "who added"** on a task. Projects have no immutable creator separate from the (re-assignable)
  owner, and no `completed_by`. Household has no record of who marked an item purchased.
- **Gap in the UI:** attribution is shown nowhere — `projects` cards and `TaskItem` hardcode the
  owner name to `null`; `household.added_by` is stored but never displayed.

## Decisions (from brainstorming)

- Cover **Tasks, Projects, Household, and Inbox**.
- Attribute **who added (creator)** and **who completed**.
- Display **avatar + first name inline** on rows/cards, with fuller detail on item pages.
- Use **denormalized creator/completer columns** on each entity (matching `household.added_by` /
  `inbox.captured_by`) rather than querying the activity log per item — simpler and faster; the
  activity log can be pruned.

## Design

### 1. Data model — migration `0003_attribution.sql`

Add immutable attribution columns (all nullable `uuid` referencing `users(id)`):

| Table | New column | Meaning |
|---|---|---|
| `tasks` | `created_by` | who added the task |
| `projects` | `created_by` | who created the project (immutable; `owner_id` remains the assignable owner) |
| `projects` | `completed_by` | who completed the project |
| `household_items` | `last_purchased_by` | who last marked the item stocked ("Got it") |

Already present (reused, not added): `tasks.completed_by`, `inbox_items.captured_by`,
`household_items.added_by`.

**Backfill (in the migration):**
- `projects.created_by = owner_id` (owner defaulted to the creator on create).
- `tasks.created_by` ← the actor of the matching `activity_events` row
  (`entity_type='task' AND action='created'`) where one exists; otherwise left null.
- `projects.completed_by`, `household_items.last_purchased_by` ← left null (no reliable history).

Update the Drizzle schema (`schema/tasks.ts`, `schema/projects.ts`, `schema/household.ts`) to add
the columns with `.references(() => users.id)`. Add indexes only if a query filters on them
(none planned → no new indexes).

### 2. Shared types — `packages/shared-types`

```ts
export interface UserRef {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}
```

Extend the relevant API output types with optional resolved-user fields (see §3). Nullable where
the underlying id can be null.

### 3. API — record + resolve

**Record (set the ids on write):**
- `TaskService.create` → `createdBy: userId`.
- `ProjectService.create` → `createdBy: userId` (keep `ownerId` behavior unchanged).
- `ProjectService.complete` → set `completedBy: userId` when transitioning to `completed`
  (alongside the existing `completedAt`).
- `HouseholdService` "Got it"/stocked transition (the method that sets `status:'stocked'` +
  `lastPurchased`) → also set `lastPurchasedBy: userId`.
- `tasks.completed_by` is already set by `TaskService.complete`/`update` — no change.
- `inbox.captured_by` already set on capture — no change.

**Resolve (enrich reads):** a shared helper in `apps/api/src/services/`:

```ts
// resolveUsers(db, ids) → Map<string, UserRef>, deduped, ignoring null/undefined ids
export async function resolveUsers(db: Database, ids: Array<string | null | undefined>): Promise<Map<string, UserRef>>;
```

Each list/get query collects the relevant ids, calls `resolveUsers` once, and attaches:

| Query | Added fields |
|---|---|
| `task.list` / `project.get` task nodes | `createdByUser`, `completedByUser`, `ownerUser` |
| `project.list` / `project.get` | `createdByUser`, `ownerUser`, `completedByUser` |
| `household.list` | `addedByUser`, `lastPurchasedByUser` |
| `inbox.list` | `capturedByUser` |

All fields are `UserRef | null`. This also **fixes the existing "owner name shows as null" gap**
(the project/task owner now resolves to a real `UserRef`).

### 4. UI — `@lifesync/ui` + web surfaces

- **`UserChip`** (new shared component): a small `Avatar` (`size="sm"`) + the person's first name,
  with an optional `label` prefix (e.g. "Added by"). Props: `{ user: UserRef | null; label?: string }`.
  Renders an em dash ("—") placeholder when `user` is null. First name = `displayName.split(' ')[0]`.
- **`TaskItem`** → show the creator via `UserChip` inline (replaces the hardcoded `ownerName: null`);
  when the task is completed, also show the completer (`label="Completed by"`). Update its props to
  accept `createdByUser`/`completedByUser` (`UserRef | null`) instead of the current `ownerName`.
- **`ProjectCard`** → creator `UserChip` (fixes the null owner display).
- **Household `StockItemRow`** → "Added by X"; when stocked, also "Got it · Y" via `UserChip`/labels.
- **Inbox `InboxItemRow`** → captured-by `UserChip`.
- **Detail pages** (project detail, `TaskForm`) → a fuller attribution line, e.g.
  "Added by Alex · Completed by Jordan".

Web callers pass the resolved `UserRef`s from the enriched API responses.

## Testing

- **API services:** `created_by` set on task/project create; `completed_by` set on project complete;
  `last_purchased_by` set on the household "Got it" transition; `resolveUsers` dedupes and maps ids
  → `UserRef` (and ignores nulls); `task.list`/`project.list`/`project.get`/`household.list`/
  `inbox.list` include the enriched user fields.
- **UI:** `UserChip` renders the first name and the optional label; renders "—" for a null user.
  `TaskItem`/`ProjectCard`/`StockItemRow`/`InboxItemRow` display the correct person. Existing tests
  updated for the new `TaskItem` props.

## Non-goals (YAGNI)

- No per-item activity/history timeline (separate future epic — the `activity_events` log already
  exists for it).
- No "last edited by".
- No membership/invite/role changes — that is the next, separate feature
  (visibility/encapsulation for multiple members).
- No changes to `apps/mobile`.

## Affected files (indicative)

- **DB:** `apps/api/src/db/migrations/0003_attribution.sql` (new); `schema/tasks.ts`,
  `schema/projects.ts`, `schema/household.ts` (add columns).
- **shared-types:** add `UserRef`; extend task/project/household/inbox output types.
- **API:** `services/task.service.ts`, `services/project.service.ts`, `services/household.service.ts`,
  `services/inbox.service.ts`, a new `services/resolve-users.ts`; corresponding service/router tests.
- **UI:** `packages/ui` `UserChip` (new) + `TaskItem` and `ProjectCard` (props change); web
  `StockItemRow`, `InboxItemRow`, project list/detail pages, `TaskForm`. (Verify `ProjectCard`'s
  location during planning — it is in `@lifesync/ui`.)
