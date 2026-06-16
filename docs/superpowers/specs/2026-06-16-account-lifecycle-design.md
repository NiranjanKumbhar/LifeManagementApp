# Account Lifecycle — Provisioning Hardening & Account/Data Deletion — Design

> **Date:** 2026-06-16
> **Status:** Approved (design), pending implementation plan
> **Scope:** `apps/api` + `apps/web` + shared-types + a prod env change. No `apps/mobile`.

## Problem (two live incidents + a planned feature)

1. **Re-signup with a deleted account's email → 500.** Clerk "Delete account" removes the Clerk
   user, but the app only handles `user.created`/`user.updated` webhooks — **not `user.deleted`** —
   leaving an orphaned `users` row. `upsertUser` keys on `clerkId`, so re-signup (new clerkId, same
   email) violates the `users_email_key` unique constraint.
2. **New users can end up with the wrong/extra workspace.** `ensureOwnWorkspace` has a
   `DEFAULT_WORKSPACE_ID` dev-fallback that drops users toward the seeded "Our Home", and the
   auto-create can collide with a create prompt → duplicate workspaces.
3. **No in-app account/data deletion** (the planned "Danger Zone").

Root constraint: most `users.id` foreign keys are `RESTRICT`, so a user row can't simply be deleted —
this is why `user.deleted` was stubbed as "acknowledge and ignore."

## Decisions (from brainstorming)

- Treat all of the above as **one account-lifecycle feature**.
- **New users auto-get "X's Home"** (no create prompt); the `NoWorkspace` empty-state is
  recovery-only (zero workspaces).
- Deletion is **permanent** (no soft-delete / undo / export).

## Design

### 1. Provisioning hardening — `user-provisioning.service.ts`

- **`upsertUser` reclaims by email.** Look up an existing user by `clerkId` OR `email`; if found,
  `UPDATE` that row (set `clerkId`, `email`, `displayName`, `avatarUrl`, `updatedAt`); else `INSERT`.
  This makes re-signup after a Clerk delete reclaim the (orphaned) row instead of 500'ing, and still
  handles normal `clerkId` updates.
- **`ensureOwnWorkspace` always creates a personal workspace.** Remove the `DEFAULT_WORKSPACE_ID`
  dev-fallback branch entirely: if the user has no membership, create `"<firstName>'s Home"` and
  enroll them as `owner`. New users therefore always have exactly one workspace and never land in the
  seeded demo workspace.
- **Config:** remove `DEFAULT_WORKSPACE_ID` from the production environment (and the web
  `NEXT_PUBLIC_DEFAULT_WORKSPACE_ID` is already gone since slice A). Document this in the deploy note.

### 2. Safe-deletion foundation — migration `0007_user_fk_ondelete.sql`

Drop and re-add the `users.id` foreign keys with explicit `ON DELETE` behavior so a user row can be
deleted cleanly (the plan confirms exact constraint names from `0000_initial_schema.sql`, which use
Drizzle's `<table>_<column>_users_id_fk` convention):

- **`ON DELETE SET NULL`** (nullable attribution — content stays, attribution becomes null):
  `projects.owner_id`, `projects.created_by`, `projects.completed_by`,
  `tasks.owner_id`, `tasks.completed_by`, `tasks.created_by`,
  `household_items.added_by`, `household_items.last_purchased_by`,
  `inbox_items.owner_id`, `workspace_invites.accepted_by`.
- **`ON DELETE CASCADE`** (the user's own `NOT NULL` rows — removed with them):
  `activity_events.user_id`, `reminders.user_id`, `inbox_items.captured_by`,
  `resources.uploaded_by`, `workspace_invites.invited_by`.
  (`workspace_members.user_id` already cascades; `notifications.user_id` already cascades.)

Mirror each change in the Drizzle schema's `.references(() => users.id, { onDelete: … })` so pglite
tests exercise the same behavior.

### 3. `AccountService` (new) — `apps/api/src/services/account.service.ts`

Shared by the webhook and the in-app mutations.

- **`deleteAccount(db, userId)`** → `Result<void>`:
  1. Load the user; no-op if absent.
  2. For each workspace the user belongs to:
     - **Sole member** → delete the workspace (cascades all its data).
     - **Other members exist** → delete the user's membership; if the user was the only `owner`,
       promote the earliest-joined remaining member to `owner` (keeps an owner).
  3. Delete the `users` row. The §2 FK rules null attribution and cascade personal rows.
- **`clearData(db, userId)`** → `Result<void>`: same as steps 2 (solo → delete workspace; shared →
  leave + promote), but **does not** delete the `users` row. The user keeps their account and lands on
  the `NoWorkspace` empty-state.

### 4. Webhook + in-app API

- **`deleteAccount(db, userId)`** is the single signature. The webhook resolves the DB user by
  `clerkId` first (`db.query.users.findFirst({ where: eq(users.clerkId, id) })`); if found, calls
  `deleteAccount(db, user.id)`; if absent, no-op (idempotent).
- **`webhooks/clerk.ts`:** add `case 'user.deleted'` (both the http and fetch handlers) → resolve the
  user by `event.data.id` (clerkId) → `AccountService.deleteAccount(db, user.id)`.
- **`account` router (new), root-mounted:**
  - `account.delete` (`protectedProcedure`, no input) → load the user row first to capture its
    `clerkId`, run `AccountService.deleteAccount(db, ctx.userId)` (DB first), then best-effort
    `clerkClient.users.deleteUser(clerkId)`. DB-first means the later `user.deleted` webhook is a
    harmless no-op; a Clerk-delete failure is caught/logged, not fatal (the mutation still succeeds).
  - `account.clearData` (`protectedProcedure`, no input) → `AccountService.clearData(db, ctx.userId)`.

### 5. Web — Settings "Danger Zone"

- New `apps/web/src/components/settings/DangerZone.tsx` (a red `SectionCard`), added to the Settings
  page:
  - **Delete account & data:** a button reveals a confirm step requiring the user to **type their
    email**; on match, calls `account.delete`; on success, `useClerk().signOut()` then redirect to
    `/sign-in`. Clear copy: "This permanently deletes your account, the workspaces you solely own, and
    removes you from shared ones."
  - **Clear my data:** a button → confirm step → `account.clearData`; on success invalidate
    `workspace.mine` (the provider drops to the empty-state). Copy: "Deletes workspaces you solely own
    and leaves shared ones; your account stays."
- Both controls disabled while pending; errors via toast.

### 6. Testing

- **API:** `upsertUser` reclaims an existing-email row (no unique violation); `ensureOwnWorkspace`
  always creates a personal workspace (no DEFAULT join); `deleteAccount` (solo workspace deleted;
  shared workspace kept with ownership promoted; user row gone; a surviving project's `createdBy`
  nulled; the user's activity/reminders cascaded away); `clearData` (workspaces gone, user row kept);
  `user.deleted` webhook path; `account.delete`/`clearData` router procedures.
- **Web:** `DangerZone` — delete requires the matching email before enabling; calls the right
  mutation; `clearData` confirm calls `account.clearData`.

## Non-goals

- No data export/download, no soft-delete/undo (permanent).
- No transfer-ownership UI (deletion auto-promotes a remaining member).
- No mobile.

## Affected files (indicative)

- **DB:** `migrations/0007_user_fk_ondelete.sql` (new); `schema/*` FK `onDelete` updates.
- **shared-types:** none required (no new entity shapes; `account` procedures return void).
- **API:** `services/user-provisioning.service.ts` (reclaim + always-personal), new
  `services/account.service.ts`, `webhooks/clerk.ts` (`user.deleted`), new `routers/account.ts` +
  root router, `lib/clerk.ts` usage (deleteUser); tests.
- **Web:** `components/settings/DangerZone.tsx` (+ test), `app/(app)/settings/page.tsx` (mount).
- **Env/deploy:** remove `DEFAULT_WORKSPACE_ID` from production; apply migration `0007`.
