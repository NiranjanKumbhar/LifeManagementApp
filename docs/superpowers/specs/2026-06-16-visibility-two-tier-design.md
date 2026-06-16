# Workspace Membership — Slice C: Visibility & Encapsulation (Shared / Private) — Design

> **Date:** 2026-06-16
> **Status:** Approved (design), pending implementation plan
> **Epic:** Workspace membership & sharing — **A (invites, shipped) → B (roles, shipped) → C (this)**.
> **Scope:** `apps/api` + `apps/web` + shared packages. No `apps/mobile`.

## Problem / current state

The app has a 3-tier `visibility` (`shared` | `mine_visible` | `private`) on **projects** and
**inbox_items**, but:

- **`shared` and `mine_visible` are identical for reading** — `projectVisibilityCondition` is
  `or(ne(visibility,'private'), eq(ownerId,userId))`, so both are visible to all members; only
  `private` restricts (owner-only). The middle tier differs only for *writing*
  (`canWrite`: `shared` → all members; `mine_visible`/`private` → owner only).
- It's couple-centric ("mine_visible" = "visible to my partner"), which is unclear with up to 6 members.
- **Tasks** have no visibility (they inherit the project's). **Household items** have none (always
  shared). So a member can't add a private household item, nor a private task inside a shared project.

## Decisions (from brainstorming)

- **Two tiers only: `shared` and `private`.** Shared = every member can read + edit. Private = only
  the item's owner can read + edit. The `mine_visible` tier is removed.
- **Per-item privacy on Projects, Tasks, and Household items.** Inbox already does shared/private
  captures and keeps its current behavior (just consistent with the narrowed enum).
- **Privacy owner per entity:** project → `ownerId`; task → `createdBy`; household item → `addedBy`.

## Design

### 1. Visibility model

`Visibility = 'shared' | 'private'`. One rule, applied per entity:

- **read:** `private` → only the owner (per-entity owner column); `shared` → all workspace members.
- **write:** identical rule — `private` → owner only; `shared` → any member.

This drops the old `mine_visible` "visible-to-all-but-owner-edits" asymmetry entirely.

### 2. Data model — migration `0005_visibility_two_tier.sql` + schema

- **projects, inbox_items:** `UPDATE … SET visibility='shared' WHERE visibility='mine_visible';`
  then replace the `CHECK (visibility IN ('shared','mine_visible','private'))` constraint with
  `CHECK (visibility IN ('shared','private'))`. (mine_visible was visible to all → maps to shared.)
- **tasks:** add `visibility text NOT NULL DEFAULT 'shared' CHECK (visibility IN ('shared','private'))`.
- **household_items:** add the same `visibility` column.
- Update the Drizzle schema (`schema/projects.ts` already has `visibility`; add to `schema/tasks.ts`
  and `schema/household.ts`; the `Visibility` `$type` import drops `mine_visible`).
- **shared-types:** `packages/shared-types/src/enums/visibility.ts` → `'shared' | 'private'`. Add
  `visibility` to the `Task` and `HouseholdItem` entity types.
- **validation:** `visibilitySchema` (Zod) → `z.enum(['shared','private'])`. Add `visibility` to
  `createTaskSchema`/`updateTaskSchema` and `createHouseholdSchema`/`updateHouseholdSchema`.

Migration `0005` is hand-written (like 0002–0004) and must be applied to live Supabase.

### 3. Enforcement — API

**Projects** (`apps/api/src/services/authz.ts` + `project.service.ts`): simplify to the 2-tier rule.
```ts
function projectVisibilityCondition(userId) {
  return or(eq(projects.visibility, 'shared'), eq(projects.ownerId, userId));
}
canReadProject(p, userId)  = p.visibility === 'shared' || p.ownerId === userId;
canWriteProject(p, userId) = p.visibility === 'shared' || p.ownerId === userId;
```
(Behaviorally: since mine_visible no longer exists, read and write collapse to the same predicate.)

**Tasks** (`task.service.ts` `list`, `project.service.ts` `get` tree; `update`/`complete`/`reopen`):
- A task is hidden from a viewer when `visibility === 'private' && createdBy !== viewerId`.
- In `buildTaskTree`, **drop private tasks not created by the viewer along with their descendants**
  (prune the subtree). The tree builder gains a `viewerId` parameter (or rows are pre-filtered before
  tree building, but subtree pruning is cleaner in the builder).
- Writes (`update`, `complete`, `reopen`) on a private task: allowed only if `createdBy === userId`
  (else `notFound`, to avoid leaking existence). A task in a *shared* project that is itself private
  is created with `createdBy = userId`, so the creator always retains access.
- A private task's children: hiding the parent hides the subtree (handled by the prune).

**Household** (`household.service.ts` `list`, `update`, `purchase`, `restock`):
- `list` hides `visibility === 'private' && addedBy !== viewerId`.
- Writes on a private item: only `addedBy` (else `notFound`).
- `add` sets `visibility` from input (default `shared`); `addedBy` is already the creator.

**Inbox:** already enforces `private → owner`. No behavior change; it just can no longer be set to
`mine_visible` (enum narrowed). Confirm `captureInboxSchema` uses the narrowed `visibilitySchema`.

### 4. UI — consistent Shared/Private control + indicator

- **`VisibilityToggle`** (new, `@lifesync/ui`): a 2-option `SegmentedControl`-style control
  (Shared / Private) with props `{ value: Visibility; onChange: (v) => void }`. Private option shows
  a lock affordance.
- **`VisibilityBadge`/lock icon** (new or a small addition): a lock icon shown on cards/rows for
  private items. (Reuse the existing icon set in `apps/web/src/components/icons.tsx`; add a `LockIcon`
  if absent.)
- **Set visibility:**
  - `ProjectForm` — replace the 3-option Visibility `<select>` (`shared/mine_visible/private`) with the
    2-option toggle.
  - `TaskForm` — add the toggle (defaults to the parent project's… no: defaults to `shared`; a task is
    independently shared/private).
  - Household add/edit (`QuickAddBar`/`HouseholdItemForm`) — add the toggle (default shared).
- **Show visibility:** a lock icon on `ProjectCard`, `TaskItem`, and `StockItemRow` when private.
- Web callers pass `visibility` from the enriched API types (the entities now carry it).

### 5. Testing

- **API:** project read/write 2-tier (private hidden from non-owner in `list`/`get`/`search`;
  shared visible+writable by all); private task pruned from the tree for a non-creator and its
  subtree hidden; write to a private task by a non-creator → `notFound`; private household item hidden
  from non-adder in `list` and write-protected; `mine_visible`→`shared` mapping (pglite applies 0005).
- **Web:** `VisibilityToggle` renders + toggles; forms include `visibility`; private items show the
  lock indicator; `ProjectForm` no longer offers `mine_visible`.

## Non-goals

- No per-member sharing lists; no "visible but read-only" tier.
- No change to inbox behavior beyond the narrowed enum.
- No mobile. No retroactive privatizing of existing data (everything stays `shared` after migration).

## Affected files (indicative)

- **DB:** `migrations/0005_visibility_two_tier.sql` (new); `schema/tasks.ts`, `schema/household.ts`
  (add `visibility`); `schema/projects.ts` (`$type` narrows).
- **shared-types:** `enums/visibility.ts`; `entities/task.ts`, `entities/household.ts` (+ output types
  that surface `visibility`).
- **API:** `utils/validation.ts`; `services/authz.ts`, `services/project.service.ts`,
  `services/task.service.ts`, `services/household.service.ts`; service/router tests.
- **UI:** `packages/ui` `VisibilityToggle` + lock icon; web `ProjectForm`, `TaskForm`,
  `QuickAddBar`/`HouseholdItemForm`, `ProjectCard`, `TaskItem`, `StockItemRow` + tests.
