# Creator & Completer Attribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record and display who *added* and who *completed* shared items (Tasks, Projects, Household, Inbox) across the web app.

**Architecture:** Denormalized `created_by` / `completed_by` / `last_purchased_by` columns on the entities (matching existing `household.added_by` / `inbox.captured_by`), a shared `resolveUsers()` helper that maps ids → `UserRef`, list/get queries enriched with resolved `UserRef`s, and a shared `UserChip` component rendering avatar + first name. Foundation first, then one repeated per-entity pattern.

**Tech Stack:** Drizzle + Postgres (pglite in tests), tRPC v11, `@lifesync/shared-types`, `@lifesync/ui` (Avatar), Next.js client components, Vitest + RTL + pglite integration tests.

**Spec:** `docs/superpowers/specs/2026-06-15-creator-attribution-design.md`

---

## File Structure

- `apps/api/src/db/migrations/0003_attribution.sql` (create) — add columns + backfill.
- `apps/api/src/db/schema/{tasks,projects,household}.ts` (modify) — add columns.
- `packages/shared-types/src/entities/user.ts` (modify) — add `UserRef`; export from index.
- `apps/api/src/services/resolve-users.ts` (create) + test — id → `UserRef` map.
- `packages/ui/src/components/UserChip/` (create) — `UserChip.tsx`, `.module.css`, `.test.tsx`, `index.ts`; export from `packages/ui/src/index.ts`.
- Per entity (services + their `*.service`/router types + tests): `task.service.ts`, `project.service.ts`, `household.service.ts`, `inbox.service.ts`.
- UI: `packages/ui/.../TaskItem` and `ProjectCard` (props), web `StockItemRow`, `InboxItemRow`, project list/detail pages, `TaskForm`.

---

## Task 1: Migration + schema columns

**Files:**
- Create: `apps/api/src/db/migrations/0003_attribution.sql`
- Modify: `apps/api/src/db/schema/tasks.ts`, `apps/api/src/db/schema/projects.ts`, `apps/api/src/db/schema/household.ts`

- [ ] **Step 1: Write the migration**

Create `apps/api/src/db/migrations/0003_attribution.sql`:

```sql
-- Attribution: record who created / completed shared items.
ALTER TABLE "tasks"            ADD COLUMN "created_by"         uuid REFERENCES "users"("id");
ALTER TABLE "projects"         ADD COLUMN "created_by"         uuid REFERENCES "users"("id");
ALTER TABLE "projects"         ADD COLUMN "completed_by"       uuid REFERENCES "users"("id");
ALTER TABLE "household_items"  ADD COLUMN "last_purchased_by"  uuid REFERENCES "users"("id");

-- Backfill projects.created_by from the owner (owner defaulted to the creator).
UPDATE "projects" SET "created_by" = "owner_id" WHERE "created_by" IS NULL;

-- Backfill tasks.created_by from the 'created' activity event where one exists.
UPDATE "tasks" t
SET "created_by" = ae."user_id"
FROM "activity_events" ae
WHERE ae."entity_type" = 'task'
  AND ae."action" = 'created'
  AND ae."entity_id" = t."id"
  AND t."created_by" IS NULL;
```

- [ ] **Step 2: Add the columns to the Drizzle schema**

In `apps/api/src/db/schema/tasks.ts`, inside the `tasks` table columns, add after `completedBy`:

```ts
    createdBy: uuid('created_by').references(() => users.id),
```

In `apps/api/src/db/schema/projects.ts`, inside the `projects` table columns, add after `ownerId`:

```ts
    createdBy: uuid('created_by').references(() => users.id),
    completedBy: uuid('completed_by').references(() => users.id),
```

In `apps/api/src/db/schema/household.ts`, inside the `householdItems` table columns, add after `addedBy`:

```ts
    lastPurchasedBy: uuid('last_purchased_by').references(() => users.id),
```

- [ ] **Step 3: Verify the schema compiles and pglite tests still pass**

Run: `pnpm --filter=api test -- household` (pglite builds tables from the Drizzle schema, so a passing run confirms the new columns are valid).
Expected: PASS (existing household tests green with the new column present).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/db/migrations/0003_attribution.sql apps/api/src/db/schema/tasks.ts apps/api/src/db/schema/projects.ts apps/api/src/db/schema/household.ts
git commit -m "feat(db): attribution columns (created_by/completed_by/last_purchased_by) + backfill"
```

---

## Task 2: `UserRef` type + `resolveUsers` helper

**Files:**
- Modify: `packages/shared-types/src/entities/user.ts` and `packages/shared-types/src/index.ts`
- Create: `apps/api/src/services/resolve-users.ts`
- Create: `apps/api/src/services/__tests__/resolve-users.test.ts` (match the existing api test location/pattern — confirm the directory by reading an existing test such as the project service test; place it alongside other service integration tests)

- [ ] **Step 1: Add the `UserRef` type**

In `packages/shared-types/src/entities/user.ts`, add and export:

```ts
export interface UserRef {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}
```

In `packages/shared-types/src/index.ts`, add `UserRef` to the existing `export type { ... } from './entities/user';` block (it currently exports `User, NotificationPreferences, NotificationChannels, QuietHours`).

- [ ] **Step 2: Write the failing test**

First read an existing api integration test (e.g. `apps/api/src/services/project.service.test.ts`) to copy the pglite harness/factory imports exactly. Then create `apps/api/src/services/__tests__/resolve-users.test.ts` (or the matching location) following that harness:

```ts
// Pseudocode shape — adapt imports to the existing pglite test harness:
// - seed two users (use the existing faker factories / world helper)
// - call resolveUsers(db, [userA.id, null, userA.id, userB.id, undefined])
// - expect map.size === 2, map.get(userA.id).displayName === userA.displayName,
//   map.get(userB.id).avatarUrl === userB.avatarUrl
// - call resolveUsers(db, [null, undefined]) → expect map.size === 0
```

Write it with the real harness calls (not pseudocode) once you've read the reference test.

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter=api test -- resolve-users`
Expected: FAIL — `Cannot find module '../resolve-users'`.

- [ ] **Step 4: Implement the helper**

Create `apps/api/src/services/resolve-users.ts`:

```ts
import { inArray } from 'drizzle-orm';
import type { Database } from '../db/client';
import { users } from '../db/schema';
import type { UserRef } from '@lifesync/shared-types';

/** Map a (possibly null/duplicated) set of user ids to UserRefs. Nulls are ignored. */
export async function resolveUsers(
  db: Database,
  ids: Array<string | null | undefined>,
): Promise<Map<string, UserRef>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, displayName: users.displayName, avatarUrl: users.avatarUrl })
    .from(users)
    .where(inArray(users.id, unique));
  return new Map(rows.map((r) => [r.id, r]));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter=api test -- resolve-users`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/entities/user.ts packages/shared-types/src/index.ts apps/api/src/services/resolve-users.ts apps/api/src/services/__tests__/resolve-users.test.ts
git commit -m "feat(api): UserRef type + resolveUsers helper"
```

---

## Task 3: `UserChip` UI component

**Files:**
- Create: `packages/ui/src/components/UserChip/UserChip.tsx`, `UserChip.module.css`, `UserChip.test.tsx`, `index.ts`
- Modify: `packages/ui/src/index.ts` (barrel export)

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/components/UserChip/UserChip.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserChip } from './UserChip';

const alex = { id: 'u1', displayName: 'Alex Rivera', avatarUrl: null };

describe('UserChip', () => {
  it('shows the first name', () => {
    render(<UserChip user={alex} />);
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('renders the optional label', () => {
    render(<UserChip user={alex} label="Added by" />);
    expect(screen.getByText('Added by')).toBeInTheDocument();
  });

  it('renders a dash placeholder when there is no user', () => {
    render(<UserChip user={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter=@lifesync/ui test -- UserChip`
Expected: FAIL — `Cannot find module './UserChip'`.

- [ ] **Step 3: Implement the component**

Create `packages/ui/src/components/UserChip/UserChip.tsx`:

```tsx
import type { UserRef } from '@lifesync/shared-types';
import { Avatar } from '../Avatar';
import styles from './UserChip.module.css';

export interface UserChipProps {
  user: UserRef | null;
  label?: string;
}

export function UserChip({ user, label }: UserChipProps) {
  if (!user) return <span className={styles.empty}>{label ? `${label} —` : '—'}</span>;
  const firstName = user.displayName.split(' ')[0] || user.displayName;
  return (
    <span className={styles.chip}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
      <span className={styles.name}>{firstName}</span>
    </span>
  );
}
```

Create `packages/ui/src/components/UserChip/UserChip.module.css`:

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--ls-space-1);
  font-size: var(--ls-text-xs);
  color: var(--ls-text-secondary);
}
.label {
  color: var(--ls-text-tertiary);
}
.name {
  white-space: nowrap;
}
.empty {
  font-size: var(--ls-text-xs);
  color: var(--ls-text-tertiary);
}
```

Create `packages/ui/src/components/UserChip/index.ts`:

```ts
export { UserChip, type UserChipProps } from './UserChip';
```

- [ ] **Step 4: Export from the barrel**

In `packages/ui/src/index.ts`, add `UserChip` to the component exports following the existing pattern used for other components (e.g. next to the `TaskItem` / `ProjectCard` exports). Confirm the existing export style by reading the file first.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter=@lifesync/ui test -- UserChip`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/UserChip/ packages/ui/src/index.ts
git commit -m "feat(ui): UserChip (avatar + first name) attribution component"
```

---

## Task 4: Tasks attribution (worked pattern)

**Files:**
- Modify: `apps/api/src/services/task.service.ts` (set `createdBy`; enrich `list`)
- Modify: `apps/api/src/services/project.service.ts` (enrich the `get` task nodes)
- Modify: `packages/ui/src/components/TaskItem/TaskItem.tsx` (+ `.test.tsx`)
- Modify: web callers that pass task data to `TaskItem` (`apps/web/src/app/(app)/projects/[id]/page.tsx`)

The shape: a task list/tree node gains `createdByUser`, `completedByUser`, `ownerUser` (`UserRef | null`).

- [ ] **Step 1: Record `createdBy` on create**

In `apps/api/src/services/task.service.ts`, in `create`, add to the `.values({ ... })` insert:

```ts
            createdBy: userId,
```

- [ ] **Step 2: Enrich the task tree with users**

`TaskService.list` and `ProjectService.get` both build a task tree via `buildTaskTree(rows)`. Enrich the tree nodes after building. Read the current `TaskTreeNode` type definition (search for `TaskTreeNode` in `apps/api/src/services/`), and add optional fields:

```ts
  createdByUser?: UserRef | null;
  completedByUser?: UserRef | null;
  ownerUser?: UserRef | null;
```

Then in `TaskService.list`, after `const rows = ...` and before returning, collect ids and resolve:

```ts
import { resolveUsers } from './resolve-users';
import type { UserRef } from '@lifesync/shared-types';
// ...
const userMap = await resolveUsers(db, rows.flatMap((r) => [r.createdBy, r.completedBy, r.ownerId]));
const attach = (nodes: TaskTreeNode[]): void => {
  for (const n of nodes) {
    n.createdByUser = userMap.get(n.createdBy ?? '') ?? null;
    n.completedByUser = userMap.get(n.completedBy ?? '') ?? null;
    n.ownerUser = userMap.get(n.ownerId ?? '') ?? null;
    attach(n.children);
  }
};
const tree = buildTaskTree(rows);
attach(tree);
return ok(tree);
```

Apply the same `resolveUsers` + `attach` enrichment to the task tree returned by `ProjectService.get` (it already builds `buildTaskTree(taskRows)`; collect ids from `taskRows`).

- [ ] **Step 3: Update `TaskItem` to show attribution**

Read `packages/ui/src/components/TaskItem/TaskItem.tsx`. Replace the `ownerName: string | null` field on `TaskItemData` with:

```ts
  createdByUser: UserRef | null;
  completedByUser: UserRef | null;
```

Render a `UserChip` for the creator inline, and when `task.status === 'completed'` also render `<UserChip user={task.completedByUser} label="✓" />`. Import `UserRef` from `@lifesync/shared-types` and `UserChip` from the barrel (or relative path). Update `TaskItem.test.tsx`: the `baseTask` fixture replaces `ownerName: null` with `createdByUser: null, completedByUser: null`, and add a test that a creator's first name renders when `createdByUser` is set.

- [ ] **Step 4: Update the web caller**

In `apps/web/src/app/(app)/projects/[id]/page.tsx`, the two `TaskItem` usages currently pass `ownerName: null`. Replace with `createdByUser: task.createdByUser ?? null, completedByUser: task.completedByUser ?? null` (and the same for `child`). The enriched fields are now present on the `project.get` task nodes.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter=api test -- task && pnpm --filter=@lifesync/ui test -- TaskItem && pnpm --filter=web typecheck`
Expected: PASS / no type errors. Fix any other `TaskItem` callers the typechecker flags (e.g. the projects list page if it renders tasks) by passing the new fields.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/task.service.ts apps/api/src/services/project.service.ts packages/ui/src/components/TaskItem/ "apps/web/src/app/(app)/projects/[id]/page.tsx"
git commit -m "feat: task attribution (created/completed by) end to end"
```

---

## Task 5: Projects attribution

**Files:**
- Modify: `apps/api/src/services/project.service.ts` (set `createdBy` on create, `completedBy` on complete; enrich `list` + `get`)
- Modify: `packages/ui/src/components/ProjectCard/ProjectCard.tsx` (+ test) — read it first to learn its current props
- Modify: web project list page (`apps/web/src/app/(app)/projects/page.tsx`) — pass the resolved creator

- [ ] **Step 1: Record creator + completer**

In `ProjectService.create`, add to the `.values({ ... })` insert: `createdBy: userId,`.
In `ProjectService.complete`, where it sets `completedAt: status === 'completed' ? new Date() : existing.completedAt`, also set in the same `.set({ ... })`:

```ts
            completedBy: status === 'completed' ? userId : existing.completedBy,
```

- [ ] **Step 2: Enrich list + get**

Read the `ProjectListItem` and `ProjectWithTasks` type definitions (search `apps/api/src/services/project.service.ts` and any imported types). Add optional `createdByUser`, `ownerUser`, `completedByUser` (`UserRef | null`).

In `ProjectService.list`, after fetching `rows`, resolve and attach:

```ts
const userMap = await resolveUsers(db, rows.flatMap((r) => [r.project.createdBy, r.project.ownerId, r.project.completedBy]));
return ok(rows.map((r) => ({
  ...r.project,
  taskCount: r.taskCount,
  completedCount: r.completedCount,
  createdByUser: userMap.get(r.project.createdBy ?? '') ?? null,
  ownerUser: userMap.get(r.project.ownerId ?? '') ?? null,
  completedByUser: userMap.get(r.project.completedBy ?? '') ?? null,
} as ProjectListItem)));
```

In `ProjectService.get`, resolve `[project.createdBy, project.ownerId, project.completedBy]` and include `createdByUser`/`ownerUser`/`completedByUser` in the returned object (alongside the existing `tasks` enrichment from Task 4).

- [ ] **Step 3: Display on `ProjectCard`**

Read `packages/ui/src/components/ProjectCard/ProjectCard.tsx`. Add a `createdByUser?: UserRef | null` prop and render `<UserChip user={createdByUser ?? null} label="Added by" />`. Update its test to pass/assert a creator. (This replaces the long-standing `ownerName: null` placeholder.)

- [ ] **Step 4: Pass it from the list page**

In `apps/web/src/app/(app)/projects/page.tsx`, where `ProjectCard` is rendered with `ownerName: null` (around line 97), pass `createdByUser={p.createdByUser ?? null}` (the list rows now carry it). Remove the dead `ownerName` prop if it no longer exists on `ProjectCard`.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm --filter=api test -- project && pnpm --filter=@lifesync/ui test -- ProjectCard && pnpm --filter=web typecheck`
Expected: PASS / clean. Add/adjust a project.service test asserting `createdByUser`/`completedByUser` are populated.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/project.service.ts packages/ui/src/components/ProjectCard/ "apps/web/src/app/(app)/projects/page.tsx"
git commit -m "feat: project attribution (created/completed/owner) end to end"
```

---

## Task 6: Household attribution

**Files:**
- Modify: `apps/api/src/services/household.service.ts` (set `lastPurchasedBy` in `purchase`; enrich `list`)
- Modify: web `StockItemRow` (read first) + its test

- [ ] **Step 1: Record who marked it purchased**

In `HouseholdService.purchase`, the `applyUpdate` patch currently sets `status:'stocked', lastPurchased: new Date(), updatedAt: new Date()`. Add `lastPurchasedBy: userId,` to that patch object.

- [ ] **Step 2: Enrich `list`**

Read the `ItemRow`-returning type (the service returns `ItemRow[]`). Change `list` to return rows enriched with `addedByUser` and `lastPurchasedByUser`. Define a return type (e.g. `HouseholdItemWithUsers = ItemRow & { addedByUser: UserRef | null; lastPurchasedByUser: UserRef | null }`) and update the method signature. Implementation:

```ts
const userMap = await resolveUsers(db, rows.flatMap((r) => [r.addedBy, r.lastPurchasedBy]));
return ok(rows.map((r) => ({
  ...r,
  addedByUser: userMap.get(r.addedBy ?? '') ?? null,
  lastPurchasedByUser: userMap.get(r.lastPurchasedBy ?? '') ?? null,
})));
```

- [ ] **Step 3: Display on `StockItemRow`**

Read `apps/web/src/components/household/StockItemRow.tsx`. Add `addedByUser` / `lastPurchasedByUser` to the item props it accepts and render `<UserChip user={item.addedByUser} label="Added by" />`, plus, when stocked, `<UserChip user={item.lastPurchasedByUser} label="Got it" />`. Update `StockItemRow.test.tsx` (the fixture currently has `addedBy: null`) to include the new resolved fields and assert a name renders.

- [ ] **Step 4: Run tests + typecheck**

Run: `pnpm --filter=api test -- household && pnpm --filter=web test -- StockItemRow && pnpm --filter=web typecheck`
Expected: PASS / clean. Adjust the household page test fixture (`apps/web/src/app/(app)/household/page.test.tsx`) which also has `addedBy: null` so it provides the new fields.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/household.service.ts apps/web/src/components/household/StockItemRow.tsx apps/web/src/components/household/StockItemRow.test.tsx "apps/web/src/app/(app)/household/page.test.tsx"
git commit -m "feat: household attribution (added by / got it by)"
```

---

## Task 7: Inbox attribution

**Files:**
- Modify: `apps/api/src/services/inbox.service.ts` (enrich `list` with `capturedByUser`)
- Modify: web `InboxItemRow` (read first) + its test

- [ ] **Step 1: Enrich `list`**

In `InboxService.list`, after fetching `rows`, resolve `capturedBy` and attach. Define the enriched return type `InboxItemWithUser = InboxRow & { capturedByUser: UserRef | null }` and update the signature:

```ts
const userMap = await resolveUsers(db, rows.map((r) => r.capturedBy));
return ok(rows.map((r) => ({ ...r, capturedByUser: userMap.get(r.capturedBy) ?? null })));
```

- [ ] **Step 2: Display on `InboxItemRow`**

Read `apps/web/src/components/inbox/InboxItemRow.tsx`. Add `capturedByUser` to its item props and render `<UserChip user={item.capturedByUser} label="Captured by" />`. Update `InboxItemRow.test.tsx` to provide the field and assert the name.

- [ ] **Step 3: Run tests + typecheck**

Run: `pnpm --filter=api test -- inbox && pnpm --filter=web test -- InboxItemRow && pnpm --filter=web typecheck`
Expected: PASS / clean.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/inbox.service.ts apps/web/src/components/inbox/InboxItemRow.tsx apps/web/src/components/inbox/InboxItemRow.test.tsx
git commit -m "feat: inbox attribution (captured by)"
```

---

## Task 8: Detail-page attribution lines + full verification

**Files:**
- Modify: `apps/web/src/app/(app)/projects/[id]/page.tsx` (project detail header line)
- Modify: `apps/web/src/components/tasks/TaskForm.tsx` (attribution line in the editor)

- [ ] **Step 1: Project detail attribution**

In the project detail page, near the existing meta row, render `<UserChip user={project.createdByUser ?? null} label="Added by" />` and, when the project is completed, `<UserChip user={project.completedByUser ?? null} label="Completed by" />`. The fields come from `project.get` (Task 5).

- [ ] **Step 2: TaskForm attribution**

In `apps/web/src/components/tasks/TaskForm.tsx`, add a small read-only line near the top: `<UserChip user={task.createdByUser ?? null} label="Added by" />` and, if completed, the completer. `task` already comes from the enriched `project.get` tree (Task 4).

- [ ] **Step 3: Full verification**

Run, in order:
- `pnpm --filter=@lifesync/ui build` → success.
- `pnpm test` → all packages green (api integration, ui, web).
- `pnpm typecheck` → all packages clean.
- `pnpm --filter=web exec eslint "src" --quiet` and `pnpm --filter=api exec eslint "src" --quiet` and `pnpm --filter=@lifesync/ui exec eslint "src" --quiet` → exit 0.

- [ ] **Step 4: Manual smoke (optional, if running locally)**

With api + web running and the DB migrated (`pnpm db:migrate`): add a task/project/household item, confirm "Added by <you>" shows on the card/row; complete a task and confirm the completer shows; check the inbox row shows who captured it.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/projects/[id]/page.tsx" apps/web/src/components/tasks/TaskForm.tsx
git commit -m "feat(web): attribution lines on project + task detail"
```

---

## Self-Review Notes

- **Spec coverage:** columns + backfill (Task 1) ✓; `UserRef` + `resolveUsers` (Task 2) ✓; `UserChip` (Task 3) ✓; tasks added/completed (Task 4) ✓; projects added/completed/owner incl. the null-owner fix (Task 5) ✓; household added/got-it (Task 6) ✓; inbox captured-by (Task 7) ✓; detail-page lines (Task 8) ✓; tests at every layer ✓; non-goals (no history timeline, no last-edited, no membership, no mobile) respected ✓.
- **Type consistency:** `UserRef` defined once (Task 2) and consumed by `resolveUsers`, `UserChip`, and every enriched service type; enriched fields are consistently named `createdByUser` / `completedByUser` / `ownerUser` / `addedByUser` / `lastPurchasedByUser` / `capturedByUser` and are always `UserRef | null`; `resolveUsers(db, ids)` signature is identical at every call site; the `TaskItem` prop change (`ownerName` → `createdByUser`/`completedByUser`) is propagated to every caller in Task 4 Step 5 (typecheck gate).
- **Read-first instructions:** Tasks 4–7 explicitly require reading the target component/type file before editing (`TaskTreeNode`, `ProjectListItem`/`ProjectWithTasks`, `ProjectCard`, `StockItemRow`, `InboxItemRow`) because their exact current shapes were not pre-read; the new fields and the `UserChip` usage are specified concretely.
- **Migration note:** `0003` must be applied to live Supabase via `pnpm db:migrate` (pglite tests build from the Drizzle schema automatically) — call this out when finishing.
