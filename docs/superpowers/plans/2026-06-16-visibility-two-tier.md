# Workspace Membership — Slice C: Visibility (Shared / Private) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse visibility to two tiers (Shared = all members read+edit; Private = owner only) and let members keep individual Projects, Tasks, and Household items private.

**Architecture:** Narrow the `Visibility` enum to `'shared' | 'private'` (retire `mine_visible`); migration `0005` maps existing `mine_visible`→`shared` and adds `visibility` to tasks + household_items; per-entity enforcement uses one rule (private → owner only, where owner = project.ownerId / task.createdBy / household.addedBy); a shared `VisibilityToggle` + lock indicator drive the UI. Projects' `authz.ts` is already 2-tier-correct once `mine_visible` is gone, and `search` reuses that condition.

**Tech Stack:** Drizzle + Postgres (pglite tests), tRPC v11, Next.js client components, Vitest + RTL + pglite integration tests.

**Spec:** `docs/superpowers/specs/2026-06-16-visibility-two-tier-design.md`

**Epic:** Slice C of A→B→C (A invites, B roles — both shipped). One spec/plan.

**IMPORTANT for all tasks:** Do NOT run `pnpm format` / Prettier — it rewrites line endings repo-wide on this Windows checkout (massive CRLF churn). Only edit the files listed per task.

---

## File Structure
- `packages/shared-types/src/enums/visibility.ts` — narrow to 2 values.
- `packages/shared-types/src/entities/task.ts`, `entities/household.ts` — add `visibility`.
- `apps/api/src/db/migrations/0005_visibility_two_tier.sql` — data + columns.
- `apps/api/src/db/schema/tasks.ts`, `schema/household.ts` — add `visibility`; `schema/projects.ts` `$type` narrows automatically.
- `apps/api/src/db/seeds/development.ts` — replace the `mine_visible` example.
- `apps/api/src/utils/validation.ts` — `visibilitySchema` + task/household schemas.
- `apps/api/src/services/authz.ts` — comment cleanup (logic already 2-tier).
- `apps/api/src/services/task.service.ts`, `project.service.ts` — task privacy (set/guard/prune).
- `apps/api/src/services/household.service.ts` — household privacy.
- `packages/ui` — `VisibilityToggle` + `LockIcon`.
- web — `ProjectForm`, `TaskForm`, household `QuickAddBar`/`HouseholdItemForm`, `ProjectCard`, `TaskItem`, `StockItemRow`.

---

## Task 1: Foundation — narrow the enum, migration, schema, validation, fix `mine_visible` references

**Files:** `packages/shared-types/src/enums/visibility.ts`, `entities/task.ts`, `entities/household.ts`; `apps/api/src/db/migrations/0005_visibility_two_tier.sql`; `apps/api/src/db/schema/tasks.ts`, `schema/household.ts`; `apps/api/src/db/seeds/development.ts`; `apps/api/src/utils/validation.ts`; `apps/api/src/services/authz.ts`; `apps/web/src/components/projects/ProjectForm.tsx`.

- [ ] **Step 1: Narrow the enum + entity types**

`packages/shared-types/src/enums/visibility.ts`:
```ts
export type Visibility = 'shared' | 'private';
```
In `packages/shared-types/src/entities/task.ts`, add to the `Task` interface (near `ownerId`): `visibility: Visibility;` and add `import type { Visibility } from '../enums/visibility';`.
In `packages/shared-types/src/entities/household.ts`, add `visibility: Visibility;` to the `HouseholdItem` interface + the same import.

- [ ] **Step 2: Migration**

Create `apps/api/src/db/migrations/0005_visibility_two_tier.sql`:
```sql
-- Collapse visibility to two tiers (shared / private). mine_visible was visible
-- to all members, so it maps to shared.
UPDATE "projects" SET "visibility" = 'shared' WHERE "visibility" = 'mine_visible';
UPDATE "inbox_items" SET "visibility" = 'shared' WHERE "visibility" = 'mine_visible';

-- New per-item visibility on tasks and household items (default shared).
ALTER TABLE "tasks" ADD COLUMN "visibility" text NOT NULL DEFAULT 'shared'
  CHECK ("visibility" IN ('shared','private'));
ALTER TABLE "household_items" ADD COLUMN "visibility" text NOT NULL DEFAULT 'shared'
  CHECK ("visibility" IN ('shared','private'));
```
(Note: the existing `projects`/`inbox_items` visibility CHECK is left permissive — narrowing it would require guessing the auto-generated constraint name; the app enforces the 2-tier set via the narrowed enum + Zod. This is a deliberate, safe simplification.)

- [ ] **Step 3: Drizzle schema**

In `apps/api/src/db/schema/tasks.ts`, add to the `tasks` columns (after `createdBy`): `visibility: text('visibility').notNull().default('shared').$type<Visibility>(),` and import `Visibility` (it's defined in `schema/projects.ts` as a local `export type Visibility = ...`; import it: `import type { Visibility } from './projects';` — and update that type in `projects.ts` to `'shared' | 'private'`).
In `apps/api/src/db/schema/household.ts`, add `visibility: text('visibility').notNull().default('shared').$type<Visibility>(),` and `import type { Visibility } from './projects';`.
In `apps/api/src/db/schema/projects.ts`, change `export type Visibility = 'shared' | 'mine_visible' | 'private';` → `export type Visibility = 'shared' | 'private';`.

- [ ] **Step 4: Validation**

In `apps/api/src/utils/validation.ts`:
- `visibilitySchema` → `z.enum(['shared', 'private'])`.
- Add `visibility: visibilitySchema.optional(),` to `createTaskSchema`, `updateTaskSchema`, `createHouseholdSchema`, `updateHouseholdSchema` (read the file to place them).

- [ ] **Step 5: Fix `mine_visible` references**

Run `grep -rn "mine_visible" apps packages` and fix every hit:
- `apps/api/src/db/seeds/development.ts`: change the `visibility: 'mine_visible'` example to `visibility: 'private'` (demonstrates a private project owned by Alex; keep its `ownerId: IDS.alex`).
- `apps/web/src/components/projects/ProjectForm.tsx`: the `VISIBILITIES` array currently has `shared`/`mine_visible`/`private`. Reduce to two: `[{ value: 'shared', label: 'Shared' }, { value: 'private', label: 'Private' }]`. (The richer toggle UI comes in Task 5; this keeps the file compiling now.)
- `apps/api/src/services/authz.ts`: update the stale comment `// mine_visible and private are editable only by their owner` → `// private is editable only by its owner`. (Logic is already correct for 2 tiers; no behavior change.)
- Fix any other hits the grep surfaces the same way (map the value to `shared` unless it's clearly an owner-private case).

- [ ] **Step 6: Verify**

Run: `pnpm --filter=@lifesync/shared-types build && pnpm --filter=api test && pnpm --filter=web typecheck`
Expected: shared-types builds; api tests green (pglite builds the new columns from the Drizzle schema); web typechecks (no `mine_visible` left). Confirm `grep -rn "mine_visible" apps packages` returns nothing.

- [ ] **Step 7: Commit**
```bash
git add packages/shared-types/src/enums/visibility.ts packages/shared-types/src/entities/task.ts packages/shared-types/src/entities/household.ts apps/api/src/db/migrations/0005_visibility_two_tier.sql apps/api/src/db/schema/tasks.ts apps/api/src/db/schema/household.ts apps/api/src/db/schema/projects.ts apps/api/src/db/seeds/development.ts apps/api/src/utils/validation.ts apps/api/src/services/authz.ts apps/web/src/components/projects/ProjectForm.tsx
git commit -m "feat: collapse visibility to shared/private (enum, migration, schema, validation)"
```

---

## Task 2: Project privacy coverage (enforcement is already 2-tier)

`authz.ts` already enforces the 2-tier rule (private→owner, shared→all) for read, write, list, and search (search reuses `projectVisibilityCondition`). This task just adds explicit test coverage.

**Files:** `apps/api/src/services/project.service.test.ts` (or `routers/project.test.ts` — match where existing visibility tests live; check both).

- [ ] **Step 1: Write tests**

Add tests asserting:
- A `private` project created by Alex is NOT returned by `project.list` for Jordan, and `project.get` for Jordan → `NOT_FOUND`; but Alex sees it.
- Jordan cannot update a private project owned by Alex (→ `NOT_FOUND` or `FORBIDDEN`, whichever `loadWritableProject` yields for a non-readable project — it returns `NOT_FOUND` since read fails first).
- A `shared` project is visible to and editable by both.

Use the existing harness (`callerFor`, `world`, `createProjectInput` with `visibility: 'private'`). Read an existing project visibility test first to match assertions/patterns.

- [ ] **Step 2: Run**

Run: `pnpm --filter=api test -- project`
Expected: PASS (these should pass against the already-correct enforcement; if any fails, the enforcement has a real gap — fix `authz.ts` minimally).

- [ ] **Step 3: Commit**
```bash
git add apps/api/src/services/project.service.test.ts apps/api/src/routers/project.test.ts
git commit -m "test(api): project shared/private visibility coverage"
```

---

## Task 3: Task privacy

**Files:** `apps/api/src/services/task.service.ts`, `apps/api/src/services/project.service.ts`, `apps/api/src/routers/task.test.ts`.

A private task is visible/editable only by its `createdBy`. Hidden tasks (and their whole subtree) are pruned from the tree.

- [ ] **Step 1: Write failing tests**

Add to `apps/api/src/routers/task.test.ts`:
```ts
describe('taskRouter — task privacy', () => {
  it('hides a private task (and its subtree) from non-creators', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const project = await alex.project.create(
      createProjectInput({ workspaceId: world.workspace.id, title: 'Shared proj' }),
    );
    const secret = await alex.task.create({ projectId: project.id, title: 'Secret', visibility: 'private' });
    await alex.task.create({ projectId: project.id, parentId: secret.id, title: 'Secret child' });
    await alex.task.create({ projectId: project.id, title: 'Open task' });

    const alexList = await alex.task.list({ projectId: project.id });
    const jordanList = await jordan.task.list({ projectId: project.id });
    const titles = (nodes: { title: string; children: { title: string }[] }[]): string[] =>
      nodes.flatMap((n) => [n.title, ...titles(n.children)]);
    expect(titles(alexList)).toEqual(expect.arrayContaining(['Secret', 'Secret child', 'Open task']));
    expect(titles(jordanList)).toContain('Open task');
    expect(titles(jordanList)).not.toContain('Secret');
    expect(titles(jordanList)).not.toContain('Secret child');
  });

  it('forbids a non-creator from editing a private task', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const project = await alex.project.create(createProjectInput({ workspaceId: world.workspace.id }));
    const secret = await alex.task.create({ projectId: project.id, title: 'Secret', visibility: 'private' });
    await expect(
      jordan.task.update({ id: secret.id, title: 'hax' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run (fails)**

Run: `pnpm --filter=api test -- task`
Expected: FAIL — `visibility` not set on create / private tasks not hidden.

- [ ] **Step 3: Set visibility on create**

In `apps/api/src/services/task.service.ts` `create`, add to the `.values({...})`: `visibility: input.visibility ?? 'shared',`.

- [ ] **Step 4: Guard private-task writes**

Add a tiny helper and apply it in `update`, `complete`, and `reopen` right after the `existing` task is loaded (and before/after `loadWritableProject`). After `const existing = ...; if (!existing) return notFound;` add:
```ts
    if (existing.visibility === 'private' && existing.createdBy !== userId) {
      return { success: false, error: notFound('Task not found') };
    }
```
Apply the identical 3-line guard in all three methods (`update` ~line 138, `complete` ~line 206, `reopen` — find it). This hides existence and blocks edits by non-creators.

- [ ] **Step 5: Prune private tasks from the tree**

In `apps/api/src/services/task.service.ts`, add a module-level helper near `buildTaskTree`:
```ts
function prunePrivateTasks(nodes: TaskTreeNode[], viewerId: string): TaskTreeNode[] {
  return nodes
    .filter((n) => !(n.visibility === 'private' && n.createdBy !== viewerId))
    .map((n) => ({ ...n, children: prunePrivateTasks(n.children, viewerId) }));
}
```
(If `buildTaskTree`/`TaskTreeNode` is duplicated in `project.service.ts`, add the same helper there — or, cleaner, both already import from a shared util? They don't; replicate the helper in `project.service.ts` too.)

In `TaskService.list`, after building the tree (and before/after the attribution `attach`), apply the prune with `userId`:
```ts
const tree = prunePrivateTasks(buildTaskTree(rows), userId);
// ...then the existing resolveUsers/attach over `tree`...
return ok(tree);
```
In `ProjectService.get`, the tree is built from `taskRows`; prune it with `userId` the same way before returning. The viewer is the `get` caller (`userId`).

- [ ] **Step 6: Run (passes) + typecheck**

Run: `pnpm --filter=api test -- task && pnpm --filter=api typecheck`
Expected: PASS / clean.

- [ ] **Step 7: Commit**
```bash
git add apps/api/src/services/task.service.ts apps/api/src/services/project.service.ts apps/api/src/routers/task.test.ts
git commit -m "feat(api): private tasks — set/guard/prune (hidden from non-creators)"
```

---

## Task 4: Household privacy

**Files:** `apps/api/src/services/household.service.ts`, `apps/api/src/routers/household.test.ts`.

Private household item = visible/editable only by `addedBy`.

- [ ] **Step 1: Write failing tests**

Add to `apps/api/src/routers/household.test.ts`:
```ts
describe('householdRouter — item privacy', () => {
  it('hides a private item from other members and blocks their edits', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const secret = await alex.household.add({
      workspaceId: world.workspace.id, name: 'Surprise gift', visibility: 'private',
    });
    await alex.household.add({ workspaceId: world.workspace.id, name: 'Milk' });

    const jordanList = await jordan.household.list({ workspaceId: world.workspace.id });
    expect(jordanList.map((i) => i.name)).toContain('Milk');
    expect(jordanList.map((i) => i.name)).not.toContain('Surprise gift');

    await expect(
      jordan.household.update({ id: secret.id, name: 'peek' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
```
(Confirm `household.add`'s input/route name and shape from the existing test before writing.)

- [ ] **Step 2: Run (fails)**

Run: `pnpm --filter=api test -- household`

- [ ] **Step 3: Implement**

In `apps/api/src/services/household.service.ts`:
- `add`: add `visibility: input.visibility ?? 'shared',` to the insert `.values({...})`.
- `list`: after fetching `rows`, filter private items the viewer doesn't own. The service's `list` currently takes `(db, input)` and has no `userId` — **add a `userId` param** to `list` (and pass `ctx.userId` from the router). Then filter:
```ts
const visible = rows.filter((r) => r.visibility !== 'private' || r.addedBy === userId);
```
and enrich/return `visible` (preserve the existing attribution enrichment from the attribution feature — apply `resolveUsers`/mapping over `visible`).
- `update`, `purchase`, `restock`: each loads `existing` and checks `assertWorkspaceMembership`. After that check add:
```ts
if (existing.visibility === 'private' && existing.addedBy !== userId) {
  return { success: false, error: notFound('Item not found') };
}
```
In `apps/api/src/routers/household.ts`, update the `list` procedure to pass `ctx.userId` to `HouseholdService.list(ctx.db, ctx.userId, input)` (read the router to apply correctly; it's a `workspaceProcedure`).

- [ ] **Step 4: Run (passes) + typecheck**

Run: `pnpm --filter=api test -- household && pnpm --filter=api typecheck`
Expected: PASS / clean.

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/services/household.service.ts apps/api/src/routers/household.ts apps/api/src/routers/household.test.ts
git commit -m "feat(api): private household items (hidden from non-adders)"
```

---

## Task 5: UI primitives — `VisibilityToggle` + lock icon

**Files:** `packages/ui/src/components/VisibilityToggle/` (new: `.tsx`, `.module.css`, `.test.tsx`, `index.ts`), `packages/ui/src/index.ts`; `apps/web/src/components/icons.tsx` (add `LockIcon` if absent).

- [ ] **Step 1: Failing test**

Create `packages/ui/src/components/VisibilityToggle/VisibilityToggle.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisibilityToggle } from './VisibilityToggle';

describe('VisibilityToggle', () => {
  it('shows the current value and switches', async () => {
    const onChange = vi.fn();
    render(<VisibilityToggle value="shared" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /private/i }));
    expect(onChange).toHaveBeenCalledWith('private');
  });
});
```

- [ ] **Step 2: Run (fails)** — `pnpm --filter=@lifesync/ui test -- VisibilityToggle`.

- [ ] **Step 3: Implement**

Read `packages/ui/src/components/SegmentedControl/SegmentedControl.tsx` to reuse it. Create `packages/ui/src/components/VisibilityToggle/VisibilityToggle.tsx`:
```tsx
import type { Visibility } from '@lifesync/shared-types';
import { SegmentedControl } from '../SegmentedControl/SegmentedControl';

export interface VisibilityToggleProps {
  value: Visibility;
  onChange: (value: Visibility) => void;
}

const OPTIONS = [
  { value: 'shared', label: 'Shared' },
  { value: 'private', label: 'Private' },
];

export function VisibilityToggle({ value, onChange }: VisibilityToggleProps) {
  return (
    <SegmentedControl
      options={OPTIONS}
      value={value}
      onChange={(v) => onChange(v as Visibility)}
      ariaLabel="Visibility"
    />
  );
}
```
(Confirm `SegmentedControl`'s prop names from its source — `options`/`value`/`onChange`/`ariaLabel` per `AppearanceSettings.tsx` usage. Adjust if different.) Create `index.ts` re-exporting it and add to `packages/ui/src/index.ts`'s barrel.

Add a `LockIcon` to `apps/web/src/components/icons.tsx` if there isn't one (match the existing icon style — an SVG functional component taking `size`).

- [ ] **Step 4: Run (passes)** — `pnpm --filter=@lifesync/ui test -- VisibilityToggle && pnpm --filter=@lifesync/ui build`.

- [ ] **Step 5: Commit**
```bash
git add packages/ui/src/components/VisibilityToggle/ packages/ui/src/index.ts apps/web/src/components/icons.tsx
git commit -m "feat(ui): VisibilityToggle + lock icon"
```

---

## Task 6: UI wiring — set + show visibility across surfaces

**Files (read each before editing):** `apps/web/src/components/projects/ProjectForm.tsx`, `apps/web/src/components/tasks/TaskForm.tsx`, `apps/web/src/components/household/HouseholdItemForm.tsx` (+ `QuickAddBar.tsx` if it creates items), `packages/ui/.../ProjectCard/ProjectCard.tsx`, `packages/ui/.../TaskItem/TaskItem.tsx`, `apps/web/src/components/household/StockItemRow.tsx`, and the matching test files.

- [ ] **Step 1: Set visibility in the forms**

- `ProjectForm.tsx`: replace the `Input as="select"` for visibility (now 2 options from Task 1) with `<VisibilityToggle value={visibility} onChange={setVisibility} />` (state already exists). Import `VisibilityToggle` from `@lifesync/ui`.
- `TaskForm.tsx`: add a `visibility` state seeded from `task.visibility ?? 'shared'`, render `<VisibilityToggle value={visibility} onChange={setVisibility} />`, and include `visibility` in the `task.update` mutation payload.
- Household create UI (`HouseholdItemForm.tsx` and/or `QuickAddBar.tsx` — whichever submits `household.add`): add a `visibility` toggle (default `shared`) and pass it in the `add` payload; in `HouseholdItemForm` edit mode include it in the update.

- [ ] **Step 2: Show the lock indicator**

- `ProjectCard.tsx` (packages/ui): accept a `visibility?: Visibility` prop and render the lock icon when `visibility === 'private'`. (ProjectCard is in `@lifesync/ui`; if it can't import the web `LockIcon`, add a minimal inline lock SVG in ui, or pass an icon node — keep it simple with a small inline SVG in ui.)
- `TaskItem.tsx` (packages/ui): accept `visibility` on its `TaskItemData` and render the lock when private.
- `StockItemRow.tsx` (web): render the web `LockIcon` when `item.visibility === 'private'`.
- Pass `visibility` from the callers (project list/detail, task rows, household rows) — the API types now include it.

- [ ] **Step 3: Update tests**

Update `ProjectForm.test.tsx` (no longer a 3-option select; toggle present), `TaskForm.test.tsx` (visibility in payload), `ProjectCard.test.tsx`/`TaskItem.test.tsx`/`StockItemRow.test.tsx` (lock shows when private; fixtures gain `visibility`). Read each test first; extend minimally.

- [ ] **Step 4: Run + typecheck**

Run: `pnpm --filter=@lifesync/ui build && pnpm --filter=web test && pnpm --filter=web typecheck`
Expected: PASS / clean. Fix any caller the typechecker flags for the new `visibility` prop.

- [ ] **Step 5: Commit**
```bash
git add packages/ui apps/web/src/components/projects apps/web/src/components/tasks apps/web/src/components/household
git commit -m "feat(web): Shared/Private toggle in forms + lock indicator on cards/rows"
```

---

## Task 7: Full verification

- [ ] **Step 1:** `pnpm --filter=@lifesync/shared-types build && pnpm --filter=@lifesync/ui build` → success.
- [ ] **Step 2:** `pnpm test` → all packages green.
- [ ] **Step 3:** `pnpm typecheck` (all 5) and `pnpm --filter=web exec eslint "src" --quiet && pnpm --filter=api exec eslint "src" --quiet` → clean. Confirm `grep -rn "mine_visible" apps packages` returns nothing.
- [ ] **Step 4 (manual, optional):** with the DB migrated (apply `0005` via Supabase — hand-written like 0002–0004): create a Private project/task/household item as one member; confirm another member can't see them; toggles + lock icons render.

---

## Self-Review Notes
- **Spec coverage:** 2-tier model + enum narrow (T1) ✓; migration mapping + new columns (T1) ✓; validation (T1) ✓; project enforcement already-correct + tested (T2) ✓; task privacy set/guard/prune incl. subtree (T3) ✓; household privacy (T4) ✓; UI toggle + lock primitives (T5) and wiring across forms/cards/rows (T6) ✓; inbox unchanged beyond enum ✓; tests each layer ✓.
- **Deviation from spec:** the spec said "tighten the projects/inbox CHECK"; the plan instead leaves that CHECK permissive (data UPDATE only) to avoid guessing the auto-generated constraint name, relying on the narrowed enum + Zod for enforcement. Safe and noted in T1 Step 2.
- **Type consistency:** `Visibility = 'shared' | 'private'` defined once (shared-types) and mirrored in `schema/projects.ts`'s local type; `visibility` added to Task/HouseholdItem entities + the task/household Zod schemas; privacy-owner columns are `project.ownerId` / `task.createdBy` / `household.addedBy` consistently in guards and prune; `HouseholdService.list` gains a `userId` param wired from the router.
- **Migration:** `0005` is hand-written (not in drizzle journal) → apply to live Supabase at deploy, like 0002–0004. pglite builds the new columns from the Drizzle schema, so tests don't need the SQL.
```
