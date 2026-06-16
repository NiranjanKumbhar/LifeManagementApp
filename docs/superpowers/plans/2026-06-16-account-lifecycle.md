# Account Lifecycle — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make account provisioning re-signup-safe, give new users exactly one workspace, and support clean account/data deletion (in-app Danger Zone + Clerk `user.deleted` webhook), backed by FK `ON DELETE` rules that let a user row be removed safely.

**Architecture:** Harden `upsertUser` (reclaim by email) + `ensureOwnWorkspace` (always personal, drop DEFAULT auto-join); migration `0007` + Drizzle schema set `ON DELETE SET NULL`/`CASCADE` on `users.id` FKs; a new `AccountService` deletes solo workspaces / leaves shared (promoting an owner) and removes the user; a new `account` router + the `user.deleted` webhook + a Settings Danger Zone expose it.

**Tech Stack:** Drizzle + Postgres (pglite tests), tRPC v11, Clerk (`clerkClient.users.deleteUser`, `useClerk().signOut`), Next.js, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-06-16-account-lifecycle-design.md`

**IMPORTANT for all tasks:** Do NOT run `pnpm format` / Prettier (repo-wide CRLF churn on this Windows checkout). Only edit the files listed per task.

---

## File Structure
- `apps/api/src/services/user-provisioning.service.ts` — reclaim-by-email + always-personal workspace.
- `apps/api/src/db/migrations/0007_user_fk_ondelete.sql` (new) + `apps/api/src/db/schema/*` — FK `onDelete`.
- `apps/api/src/services/account.service.ts` (new) — `deleteAccount` / `clearData`.
- `apps/api/src/webhooks/clerk.ts` — `user.deleted`.
- `apps/api/src/routers/account.ts` (new) + `apps/api/src/routers/index.ts` — `account.delete` / `account.clearData`.
- `apps/web/src/components/settings/DangerZone.tsx` (+ test) + `apps/web/src/app/(app)/settings/page.tsx`.

---

## Task 1: Provisioning hardening

**Files:** `apps/api/src/services/user-provisioning.service.ts`, `apps/api/src/services/user-provisioning.service.test.ts`

- [ ] **Step 1: Failing tests**

Add to `apps/api/src/services/user-provisioning.service.test.ts` (it uses the pglite harness + `insertUser`):
```ts
it('reclaims an existing row when re-signing up with the same email (new clerkId)', async () => {
  // simulate an orphaned row: same email, old clerkId
  const orphan = await insertUser(ctx.db, { email: 'reuse@example.com', clerkId: 'old_clerk' });
  await UserProvisioningService.upsertFromWebhook(ctx.db, {
    id: 'new_clerk',
    email_addresses: [{ id: 'e1', email_address: 'reuse@example.com' }],
    primary_email_address_id: 'e1',
    first_name: 'Re',
    last_name: 'Used',
  });
  const rows = await ctx.db.select().from(users).where(eq(users.email, 'reuse@example.com'));
  expect(rows).toHaveLength(1);              // reclaimed, not duplicated
  expect(rows[0]!.clerkId).toBe('new_clerk'); // clerkId updated
});

it('always creates a personal workspace for a brand-new user (no DEFAULT join)', async () => {
  delete process.env['DEFAULT_WORKSPACE_ID'];
  const user = await insertUser(ctx.db);
  await UserProvisioningService.ensureOwnWorkspace(ctx.db, user);
  const memberships = await ctx.db
    .select({ role: workspaceMembers.role, name: workspaces.name })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, user.id));
  expect(memberships).toHaveLength(1);
  expect(memberships[0]!.role).toBe('owner');
  expect(memberships[0]!.name).toMatch(/Home$/);
});
```
(Confirm `insertUser` accepts overrides `{ email, clerkId }`; if not, read the factory and adapt — insert the orphan row directly via `ctx.db.insert(users)`. Import `users`, `workspaceMembers`, `workspaces`, `eq` in the test as needed.)

- [ ] **Step 2: Run (fails)** — `pnpm --filter=api test -- user-provisioning`.

- [ ] **Step 3: Reclaim by email**

In `apps/api/src/services/user-provisioning.service.ts`, add `or` to the `drizzle-orm` import, and replace the body of `upsertUser` with:
```ts
async function upsertUser(db: Database, input: UserUpsert): Promise<UserRow> {
  const existing = await db.query.users.findFirst({
    where: or(eq(users.clerkId, input.clerkId), eq(users.email, input.email)),
  });
  if (existing) {
    const [row] = await db
      .update(users)
      .set({
        clerkId: input.clerkId,
        email: input.email,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id))
      .returning();
    return row as UserRow;
  }
  const [row] = await db
    .insert(users)
    .values({
      clerkId: input.clerkId,
      email: input.email,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
    })
    .returning();
  return row as UserRow;
}
```

- [ ] **Step 4: Always create a personal workspace**

Replace `ensureOwnWorkspace` so it drops the `DEFAULT_WORKSPACE_ID` branch entirely:
```ts
static async ensureOwnWorkspace(db: Database, user: UserRow): Promise<void> {
  const existing = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, user.id),
  });
  if (existing) return;

  const firstName = user.displayName.split(' ')[0] || user.displayName;
  await db.transaction(async (tx) => {
    const [ws] = await tx.insert(workspaces).values({ name: `${firstName}'s Home` }).returning();
    if (!ws) throw new Error('workspace insert returned no row');
    await tx.insert(workspaceMembers).values({
      workspaceId: ws.id,
      userId: user.id,
      role: 'owner',
      joinedAt: new Date(),
    });
  });
}
```
(Remove the now-unused `DEFAULT_WORKSPACE_ID`/`NODE_ENV` logic. `workspaces`/`workspaceMembers` are already imported.)

- [ ] **Step 5: Run (passes) + typecheck**

Run: `pnpm --filter=api test -- user-provisioning && pnpm --filter=api typecheck`
Expected: PASS / clean.

- [ ] **Step 6: Commit**
```bash
git add apps/api/src/services/user-provisioning.service.ts apps/api/src/services/user-provisioning.service.test.ts
git commit -m "fix(api): reclaim user by email on re-signup; always auto-create a personal workspace"
```

---

## Task 2: FK `ON DELETE` (migration + schema)

**Files:** `apps/api/src/db/migrations/0007_user_fk_ondelete.sql` (new); `apps/api/src/db/schema/{projects,tasks,household,inbox,workspaces,activity,reminders,resources}.ts`

- [ ] **Step 1: Migration SQL**

Create `apps/api/src/db/migrations/0007_user_fk_ondelete.sql`. Postgres named these inline FKs
`<table>_<column>_fkey`. Drop and re-add each with the desired behavior (run with `IF EXISTS`; the
controller verifies names against the live DB before applying to prod):
```sql
-- SET NULL: nullable attribution (content survives; attribution becomes NULL)
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_owner_id_fkey",
  ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_created_by_fkey",
  ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_completed_by_fkey",
  ADD CONSTRAINT "projects_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_owner_id_fkey",
  ADD CONSTRAINT "tasks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_completed_by_fkey",
  ADD CONSTRAINT "tasks_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_created_by_fkey",
  ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "household_items" DROP CONSTRAINT IF EXISTS "household_items_added_by_fkey",
  ADD CONSTRAINT "household_items_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "household_items" DROP CONSTRAINT IF EXISTS "household_items_last_purchased_by_fkey",
  ADD CONSTRAINT "household_items_last_purchased_by_fkey" FOREIGN KEY ("last_purchased_by") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "inbox_items" DROP CONSTRAINT IF EXISTS "inbox_items_owner_id_fkey",
  ADD CONSTRAINT "inbox_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "workspace_invites" DROP CONSTRAINT IF EXISTS "workspace_invites_accepted_by_fkey",
  ADD CONSTRAINT "workspace_invites_accepted_by_fkey" FOREIGN KEY ("accepted_by") REFERENCES "users"("id") ON DELETE SET NULL;

-- CASCADE: the user's own NOT NULL rows (removed with them)
ALTER TABLE "activity_events" DROP CONSTRAINT IF EXISTS "activity_events_user_id_fkey",
  ADD CONSTRAINT "activity_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "reminders" DROP CONSTRAINT IF EXISTS "reminders_user_id_fkey",
  ADD CONSTRAINT "reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "inbox_items" DROP CONSTRAINT IF EXISTS "inbox_items_captured_by_fkey",
  ADD CONSTRAINT "inbox_items_captured_by_fkey" FOREIGN KEY ("captured_by") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "resources" DROP CONSTRAINT IF EXISTS "resources_uploaded_by_fkey",
  ADD CONSTRAINT "resources_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "workspace_invites" DROP CONSTRAINT IF EXISTS "workspace_invites_invited_by_fkey",
  ADD CONSTRAINT "workspace_invites_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE CASCADE;
```

- [ ] **Step 2: Mirror in the Drizzle schema (drives pglite tests)**

Update each `.references(() => users.id)` to include the matching `onDelete` (the test DB is built
from these, so Task 3's deletion tests exercise the behavior):
- `schema/projects.ts`: `ownerId`, `createdBy`, `completedBy` → `{ onDelete: 'set null' }`.
- `schema/tasks.ts`: `ownerId`, `completedBy`, `createdBy` → `{ onDelete: 'set null' }`.
- `schema/household.ts`: `addedBy`, `lastPurchasedBy` → `{ onDelete: 'set null' }`.
- `schema/inbox.ts`: `ownerId` → `{ onDelete: 'set null' }`; `capturedBy` → `{ onDelete: 'cascade' }`.
- `schema/workspaces.ts`: `workspaceInvites.acceptedBy` → `{ onDelete: 'set null' }`; `invitedBy` → `{ onDelete: 'cascade' }`.
- `schema/activity.ts`: `userId` → `{ onDelete: 'cascade' }`.
- `schema/reminders.ts`: `userId` → `{ onDelete: 'cascade' }`.
- `schema/resources.ts`: `uploadedBy` → `{ onDelete: 'cascade' }`.

(For each, the form is `.references(() => users.id, { onDelete: 'set null' })`.)

- [ ] **Step 3: Verify schema compiles**

Run: `pnpm --filter=api test -- household && pnpm --filter=api typecheck`
Expected: PASS / clean (existing tests green; pglite rebuilds tables with the new onDelete rules).

- [ ] **Step 4: Commit**
```bash
git add apps/api/src/db/migrations/0007_user_fk_ondelete.sql apps/api/src/db/schema/
git commit -m "feat(db): user FK ON DELETE rules (set null attribution, cascade personal rows)"
```

---

## Task 3: `AccountService` (deleteAccount / clearData)

**Files:** `apps/api/src/services/account.service.ts` (new) + `apps/api/src/services/account.service.test.ts` (new, pglite harness)

- [ ] **Step 1: Failing tests**

Create `apps/api/src/services/account.service.test.ts` (copy the harness from `workspace.service.test.ts` / `resolve-users.test.ts`). Cover:
- **Solo workspace deleted + user removed:** seed a lone user with their own workspace + a project; `deleteAccount` → the workspace, project, and the user row are all gone.
- **Shared workspace kept, ownership promoted:** workspace with userA (owner) + userB (member); `deleteAccount(userA)` → workspace still exists, userA's membership gone, userB is now `owner`, userA's user row gone, and a project userA created in it survives with `createdBy` NULL (verifies SET NULL).
- **clearData keeps the account:** `clearData(userId)` removes their solo workspace but the `users` row still exists.

Write with the real harness (insertUser, direct inserts for projects/memberships, or callerFor + create procedures). Assert via `ctx.db.select(...)`.

- [ ] **Step 2: Run (fails)** — `pnpm --filter=api test -- account.service`.

- [ ] **Step 3: Implement**

Create `apps/api/src/services/account.service.ts`:
```ts
import { and, asc, count, eq, ne } from 'drizzle-orm';
import type { Database } from '../db/client';
import { users, workspaceMembers, workspaces } from '../db/schema';
import { internal, ok, type AppError, type Result } from '../utils/errors';

export class AccountService {
  /**
   * Remove the user from every workspace: delete the ones where they are the sole
   * member; leave the shared ones (promoting the earliest-joined remaining member
   * to owner if the leaver was the only owner). Does NOT delete the user row.
   */
  private static async detachFromWorkspaces(db: Database, userId: string): Promise<void> {
    const memberships = await db
      .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId));

    for (const m of memberships) {
      const [totalRow] = await db
        .select({ value: count() })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, m.workspaceId));
      if ((totalRow?.value ?? 0) <= 1) {
        await db.delete(workspaces).where(eq(workspaces.id, m.workspaceId)); // cascade
        continue;
      }
      if (m.role === 'owner') {
        const [ownersRow] = await db
          .select({ value: count() })
          .from(workspaceMembers)
          .where(and(eq(workspaceMembers.workspaceId, m.workspaceId), eq(workspaceMembers.role, 'owner')));
        if ((ownersRow?.value ?? 0) <= 1) {
          const next = await db.query.workspaceMembers.findFirst({
            where: and(eq(workspaceMembers.workspaceId, m.workspaceId), ne(workspaceMembers.userId, userId)),
            orderBy: asc(workspaceMembers.joinedAt),
          });
          if (next) {
            await db
              .update(workspaceMembers)
              .set({ role: 'owner' })
              .where(and(eq(workspaceMembers.workspaceId, m.workspaceId), eq(workspaceMembers.userId, next.userId)));
          }
        }
      }
      await db
        .delete(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, m.workspaceId), eq(workspaceMembers.userId, userId)));
    }
  }

  static async clearData(db: Database, userId: string): Promise<Result<void, AppError>> {
    try {
      await db.transaction(async (tx) => {
        await this.detachFromWorkspaces(tx, userId);
      });
      return ok(undefined);
    } catch (e) {
      return { success: false, error: internal('Failed to clear data', { cause: String(e) }) };
    }
  }

  static async deleteAccount(db: Database, userId: string): Promise<Result<void, AppError>> {
    try {
      await db.transaction(async (tx) => {
        await this.detachFromWorkspaces(tx, userId);
        await tx.delete(users).where(eq(users.id, userId)); // FK ON DELETE rules clean up the rest
      });
      return ok(undefined);
    } catch (e) {
      return { success: false, error: internal('Failed to delete account', { cause: String(e) }) };
    }
  }
}
```
(`this.detachFromWorkspaces(tx, …)` passes the transaction as `db` — drizzle tx satisfies the `Database` query API.)

- [ ] **Step 4: Run (passes) + typecheck** — `pnpm --filter=api test -- account.service && pnpm --filter=api typecheck`.

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/services/account.service.ts apps/api/src/services/account.service.test.ts
git commit -m "feat(api): AccountService — deleteAccount/clearData (solo-delete, shared-leave, owner-promote)"
```

---

## Task 4: `account` router + `user.deleted` webhook

**Files:** `apps/api/src/routers/account.ts` (new), `apps/api/src/routers/index.ts`, `apps/api/src/webhooks/clerk.ts`, `apps/api/src/routers/account.test.ts` (new)

- [ ] **Step 1: Failing test**

Create `apps/api/src/routers/account.test.ts` (workspace.test harness; the `@clerk/backend` mock at top already stubs `createClerkClient().users` — extend it to include `deleteUser: vi.fn()`):
```ts
describe('accountRouter', () => {
  it('clearData removes the caller’s solo workspace but keeps the account', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    const ws = await caller.workspace.create({ name: 'Solo' });
    await caller.account.clearData();
    expect(await caller.workspace.mine()).toEqual([]);
    const stillThere = await ctx.db.select().from(users).where(eq(users.id, stranger.id));
    expect(stillThere).toHaveLength(1);
  });

  it('delete removes the account row', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    await caller.workspace.create({ name: 'Solo' });
    await caller.account.delete();
    const gone = await ctx.db.select().from(users).where(eq(users.id, stranger.id));
    expect(gone).toHaveLength(0);
  });
});
```
(Import `users`, `eq`. Confirm the top-of-file `@clerk/backend` mock exposes `users.deleteUser` — add it to the mock if missing.)

- [ ] **Step 2: Run (fails)** — `pnpm --filter=api test -- account` (router test).

- [ ] **Step 3: Account router**

Create `apps/api/src/routers/account.ts`:
```ts
import { router, unwrap } from '../trpc';
import { protectedProcedure } from '../middleware/auth';
import { AccountService } from '../services/account.service';
import { clerkClient } from '../lib/clerk';

export const accountRouter = router({
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    unwrap(await AccountService.deleteAccount(ctx.db, ctx.userId)); // throws on failure → Clerk untouched
    try {
      await clerkClient.users.deleteUser(ctx.clerkId);
    } catch {
      // Best-effort: DB is already clean; a Clerk-side failure isn't fatal.
    }
  }),
  clearData: protectedProcedure.mutation(async ({ ctx }) => {
    unwrap(await AccountService.clearData(ctx.db, ctx.userId));
  }),
});
```

- [ ] **Step 4: Mount it**

In `apps/api/src/routers/index.ts`, import `accountRouter` and add `account: accountRouter,` to the root router object (read the file to match the existing style).

- [ ] **Step 5: `user.deleted` webhook**

In `apps/api/src/webhooks/clerk.ts`: import `AccountService`, `db.query` already available via `db`, and `eq` + `users` from schema. In BOTH `handleClerkWebhookFetch` and `handleClerkWebhook` switch statements, add before/with the existing cases:
```ts
      case 'user.deleted': {
        const u = await db.query.users.findFirst({ where: eq(users.clerkId, event.data.id) });
        if (u) await AccountService.deleteAccount(db, u.id);
        break;
      }
```
Remove the stale default-case comment about not acting on `user.deleted`. Add the imports (`eq` from drizzle-orm, `users` from `../db/schema`, `AccountService` from `../services/account.service`).

- [ ] **Step 6: Run (passes) + typecheck** — `pnpm --filter=api test -- account && pnpm --filter=api typecheck`.

- [ ] **Step 7: Commit**
```bash
git add apps/api/src/routers/account.ts apps/api/src/routers/index.ts apps/api/src/webhooks/clerk.ts apps/api/src/routers/account.test.ts
git commit -m "feat(api): account.delete/clearData router + user.deleted webhook cleanup"
```

---

## Task 5: Settings "Danger Zone" UI

**Files:** `apps/web/src/components/settings/DangerZone.tsx` (+ `.module.css`, + test); `apps/web/src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Failing test**

Create `apps/web/src/components/settings/DangerZone.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const deleteMutate = vi.fn();
const clearMutate = vi.fn();
const signOut = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@clerk/nextjs', () => ({ useClerk: () => ({ signOut }) }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ workspace: { mine: { invalidate: vi.fn() } } }),
    account: {
      delete: { useMutation: (o: { onSuccess?: () => void }) => ({ mutate: () => { deleteMutate(); o.onSuccess?.(); }, isPending: false }) },
      clearData: { useMutation: (o: { onSuccess?: () => void }) => ({ mutate: () => { clearMutate(); o.onSuccess?.(); }, isPending: false }) },
    },
  },
}));

import { DangerZone } from './DangerZone';

const render_ = () => render(<ToastProvider><DangerZone email="me@example.com" /></ToastProvider>);

describe('DangerZone', () => {
  it('requires the matching email before deleting, then deletes', async () => {
    render_();
    await userEvent.click(screen.getByRole('button', { name: /delete account/i }));
    const confirmBtn = screen.getByRole('button', { name: /permanently delete/i });
    expect(confirmBtn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/type your email/i), 'me@example.com');
    expect(confirmBtn).toBeEnabled();
    await userEvent.click(confirmBtn);
    expect(deleteMutate).toHaveBeenCalled();
  });

  it('clears data on confirm', async () => {
    render_();
    await userEvent.click(screen.getByRole('button', { name: /clear my data/i }));
    await userEvent.click(screen.getByRole('button', { name: /yes, clear/i }));
    expect(clearMutate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run (fails)** — `pnpm --filter=web test -- DangerZone`.

- [ ] **Step 3: Implement**

Create `apps/web/src/components/settings/DangerZone.tsx` (read `SectionCard`, `ProfileSettings.tsx`, and `Input`/`Button` for prop conventions first):
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useClerk } from '@clerk/nextjs';
import { Button, Input, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { SectionCard } from './SectionCard';
import styles from './DangerZone.module.css';

export function DangerZone({ email }: { email: string }) {
  const toast = useToast();
  const router = useRouter();
  const { signOut } = useClerk();
  const utils = trpc.useUtils();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [typed, setTyped] = useState('');

  const del = trpc.account.delete.useMutation({
    onSuccess: () => { void signOut({ redirectUrl: '/sign-in' }); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const clear = trpc.account.clearData.useMutation({
    onSuccess: () => { void utils.workspace.mine.invalidate(); toast.success('Your data was cleared'); router.push('/dashboard'); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  return (
    <SectionCard title="Danger zone">
      <div className={styles.row}>
        <div className={styles.copy}>
          <strong>Clear my data</strong>
          <span>Delete the workspaces you solely own and leave shared ones. Your account stays.</span>
        </div>
        {confirmClear ? (
          <div className={styles.actions}>
            <Button variant="secondary" size="sm" onClick={() => setConfirmClear(false)}>Cancel</Button>
            <Button size="sm" disabled={clear.isPending} onClick={() => clear.mutate()}>Yes, clear</Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => setConfirmClear(true)}>Clear my data</Button>
        )}
      </div>

      <div className={styles.row}>
        <div className={styles.copy}>
          <strong>Delete account</strong>
          <span>Permanently deletes your account, the workspaces you solely own, and removes you from shared ones.</span>
        </div>
        {confirmDelete ? null : (
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>Delete account</Button>
        )}
      </div>
      {confirmDelete ? (
        <div className={styles.confirm}>
          <Input label="Type your email to confirm" value={typed} onChange={setTyped} />
          <div className={styles.actions}>
            <Button variant="secondary" size="sm" onClick={() => { setConfirmDelete(false); setTyped(''); }}>Cancel</Button>
            <Button variant="danger" size="sm" disabled={typed !== email || del.isPending} onClick={() => del.mutate()}>
              Permanently delete
            </Button>
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}
```
If `Button` has no `variant="danger"`, read `Button.tsx` and use the closest destructive style (or add a `danger` variant minimally). Create `DangerZone.module.css` with simple row/confirm layout using `--ls-*` tokens.

- [ ] **Step 4: Mount in Settings**

In `apps/web/src/app/(app)/settings/page.tsx`, import `DangerZone` and render `<DangerZone email={me.email} />` at the bottom of the page (after `WorkspaceSettings`). `me` is already loaded there.

- [ ] **Step 5: Run + typecheck**

Run: `pnpm --filter=web test -- DangerZone && pnpm --filter=web test -- "settings/page" && pnpm --filter=web typecheck`
Expected: PASS / clean. If the settings page test needs `account.*` trpc mocks or `@clerk/nextjs` `useClerk`, add them.

- [ ] **Step 6: Commit**
```bash
git add apps/web/src/components/settings/DangerZone.tsx apps/web/src/components/settings/DangerZone.module.css apps/web/src/components/settings/DangerZone.test.tsx "apps/web/src/app/(app)/settings/page.tsx"
git commit -m "feat(web): Settings Danger Zone — delete account & data, clear my data"
```

---

## Task 6: Full verification

- [ ] **Step 1:** `pnpm --filter=@lifesync/shared-types build && pnpm --filter=@lifesync/ui build` → success.
- [ ] **Step 2:** `pnpm test` → all packages green.
- [ ] **Step 3:** `pnpm typecheck` (all 5) and `pnpm --filter=web exec eslint "src" --quiet && pnpm --filter=api exec eslint "src" --quiet` → clean.
- [ ] **Step 4 (manual, deploy-time):** apply `0007` to live (controller verifies the real FK constraint names first, since prod names may differ from the `_fkey` guesses) and **remove `DEFAULT_WORKSPACE_ID` from the production env**. Smoke: delete a throwaway account → its solo workspace/data gone, shared workspaces keep an owner; re-signup with that email works; new user lands directly in "X's Home".

---

## Self-Review Notes
- **Spec coverage:** reclaim-by-email + always-personal-workspace (T1) ✓; FK SET NULL/CASCADE migration + schema (T2) ✓; `deleteAccount`/`clearData` with solo-delete/shared-leave/owner-promote (T3) ✓; `account` router + Clerk delete + `user.deleted` webhook (T4) ✓; Danger Zone UI with type-email confirm + clear-data (T5) ✓; non-goals (no export/undo/mobile) respected ✓.
- **Type consistency:** `deleteAccount(db, userId)` / `clearData(db, userId)` single signatures used by router + webhook (webhook resolves `userId` from `clerkId` first); `ctx.clerkId` (set by auth middleware) used for `clerkClient.users.deleteUser`; `DangerZone` takes `email` from `me.email`.
- **Test vs prod FK names:** pglite builds from the Drizzle schema (T2 Step 2), so deletion tests exercise the real ON DELETE behavior without depending on SQL constraint names; the `0007` SQL (prod-only) uses the Postgres `<table>_<column>_fkey` convention with `IF EXISTS`, and the controller confirms exact names before applying to live.
- **Migrations `0007`** is hand-written (not in drizzle journal) → apply to live at deploy, like 0002–0006. Also remove `DEFAULT_WORKSPACE_ID` from prod env.
```
