# Workspace Membership — Slice A: Invites & Joining — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a workspace owner invite others via a tokenized link, let signed-in users join (capped at 6 members), give every new user their own workspace, and let users switch between the workspaces they belong to.

**Architecture:** A new `workspace_invites` table + `WorkspaceService` methods (`createInvite`/`invitePreview`/`acceptInvite`/`revokeInvite`/`listInvites`/`mine`); provisioning creates a personal workspace when a user has none; the web replaces the hardcoded active-workspace env var with a `WorkspaceProvider` (backed by `workspace.mine`) + a switcher, plus a `/join/[token]` page and invite controls in Settings.

**Tech Stack:** Drizzle + Postgres (pglite in tests), tRPC v11, Clerk auth, Resend (optional email), Next.js client components, Vitest + RTL + pglite integration tests.

**Spec:** `docs/superpowers/specs/2026-06-16-workspace-invites-design.md`

**Epic:** Slice A of A→B→C (B = roles/member-management, C = visibility). Owner-only inviter here; no visibility changes.

---

## File Structure

- `apps/api/src/db/migrations/0004_workspace_invites.sql` (create)
- `apps/api/src/db/schema/workspaces.ts` (modify — add `workspaceInvites`)
- `packages/shared-types/src/entities/workspace.ts` + `src/enums/status.ts` + `src/api/outputs.ts`/`inputs.ts` (align `WorkspaceInvite`/`InviteStatus`, add invite I/O + `mine` output)
- `apps/api/src/utils/validation.ts` (invite schemas)
- `apps/api/src/services/workspace.service.ts` (invite/accept/revoke/list/mine)
- `apps/api/src/services/user-provisioning.service.ts` (`ensureOwnWorkspace`)
- `apps/api/src/routers/workspace.ts` (+ schemas) and `apps/api/src/routers/workspace.test.ts` (update invite test)
- `apps/web/src/lib/workspace-context.tsx` (create) + `apps/web/src/lib/hooks/useWorkspaceId.ts` (rewrite) + `apps/web/src/lib/providers.tsx`
- `apps/web/src/components/app-shell/WorkspaceSwitcher.tsx` (create) + placement in `NavigationSidebar.tsx`
- `apps/web/src/app/join/[token]/page.tsx` (create)
- `apps/web/src/components/settings/WorkspaceSettings.tsx` (invite controls)

---

## Task 1: `workspace_invites` table + schema + shared types

**Files:**
- Create: `apps/api/src/db/migrations/0004_workspace_invites.sql`
- Modify: `apps/api/src/db/schema/workspaces.ts`
- Modify: `packages/shared-types/src/enums/status.ts`, `packages/shared-types/src/entities/workspace.ts`

- [ ] **Step 1: Write the migration**

Create `apps/api/src/db/migrations/0004_workspace_invites.sql`:

```sql
CREATE TABLE "workspace_invites" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "token"        text NOT NULL UNIQUE,
  "email"        text,
  "role"         text NOT NULL DEFAULT 'member' CHECK ("role" IN ('owner','member')),
  "status"       text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','accepted','revoked','expired')),
  "invited_by"   uuid NOT NULL REFERENCES "users"("id"),
  "expires_at"   timestamptz NOT NULL,
  "accepted_by"  uuid REFERENCES "users"("id"),
  "accepted_at"  timestamptz,
  "created_at"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "idx_workspace_invites_workspace" ON "workspace_invites" ("workspace_id");
```

- [ ] **Step 2: Add the Drizzle table**

In `apps/api/src/db/schema/workspaces.ts`, append (the file already imports `pgTable, uuid, text, timestamp, index, unique` and `users`; add `index` import if missing — it's already used for `workspaceMembers`):

```ts
export const workspaceInvites = pgTable(
  'workspace_invites',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    email: text('email'),
    role: text('role').notNull().default('member').$type<'owner' | 'member'>(),
    status: text('status').notNull().default('pending').$type<'pending' | 'accepted' | 'revoked' | 'expired'>(),
    invitedBy: uuid('invited_by').notNull().references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    acceptedBy: uuid('accepted_by').references(() => users.id),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('idx_workspace_invites_workspace').on(table.workspaceId),
  }),
);

export type WorkspaceInvite = typeof workspaceInvites.$inferSelect;
export type NewWorkspaceInvite = typeof workspaceInvites.$inferInsert;
```

- [ ] **Step 3: Align shared types**

In `packages/shared-types/src/enums/status.ts`, ensure `InviteStatus` is `'pending' | 'accepted' | 'revoked' | 'expired'` (read it first; adjust if it differs).

In `packages/shared-types/src/entities/workspace.ts`, ensure a `WorkspaceInvite` interface matches the columns above (`id, workspaceId, token, email: string | null, role: 'owner'|'member', status: InviteStatus, invitedBy, expiresAt: Date, acceptedBy: string | null, acceptedAt: Date | null, createdAt: Date`). Read the file first; the spec's `outputs.ts` currently has a divergent `WorkspaceInvite` — update that one (in `api/outputs.ts`) or re-export, keeping a single definition. Export from `index.ts` if not already.

- [ ] **Step 4: Verify schema compiles via pglite**

Run: `pnpm --filter=api test -- workspace`
Expected: PASS (existing workspace tests still green; pglite builds the new table from the schema).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/migrations/0004_workspace_invites.sql apps/api/src/db/schema/workspaces.ts packages/shared-types/src/enums/status.ts packages/shared-types/src/entities/workspace.ts packages/shared-types/src/api/outputs.ts
git commit -m "feat(db): workspace_invites table + aligned shared types"
```

---

## Task 2: `WorkspaceService.mine` + `workspace.mine` router + active-workspace data

**Files:**
- Modify: `apps/api/src/services/workspace.service.ts`
- Modify: `apps/api/src/routers/workspace.ts`
- Test: `apps/api/src/routers/workspace.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/routers/workspace.test.ts` a new describe block:

```ts
describe('workspaceRouter — mine', () => {
  it('returns the workspaces the user belongs to with their role', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const mine = await alex.workspace.mine();
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      workspace: { id: world.workspace.id },
      role: 'owner',
    });
  });

  it('returns empty for a user in no workspace', async () => {
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);
    expect(await caller.workspace.mine()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it (fails)**

Run: `pnpm --filter=api test -- workspace`
Expected: FAIL — `workspace.mine` is not a function.

- [ ] **Step 3: Implement `mine`**

In `apps/api/src/services/workspace.service.ts`, import `workspaceInvites` is not needed here; add:

```ts
export interface MyWorkspace {
  workspace: WorkspaceRow;
  role: 'owner' | 'member';
}

// inside WorkspaceService:
static async mine(db: Database, userId: string): Promise<Result<MyWorkspace[], AppError>> {
  const rows = await db
    .select({ workspace: workspaces, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaces.createdAt));
  return ok(rows.map((r) => ({ workspace: r.workspace, role: r.role })));
}
```

Add `asc` to the `drizzle-orm` import in this file if not present.

- [ ] **Step 4: Add the router procedure**

In `apps/api/src/routers/workspace.ts`, add (uses `protectedProcedure`, no input):

```ts
  mine: protectedProcedure.query(async ({ ctx }) => {
    return unwrap(await WorkspaceService.mine(ctx.db, ctx.userId));
  }),
```

- [ ] **Step 5: Run it (passes)**

Run: `pnpm --filter=api test -- workspace`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/workspace.service.ts apps/api/src/routers/workspace.ts apps/api/src/routers/workspace.test.ts
git commit -m "feat(api): workspace.mine — list the user's workspaces + role"
```

---

## Task 3: `ensureOwnWorkspace` provisioning

**Files:**
- Modify: `apps/api/src/services/user-provisioning.service.ts`
- Test: add `apps/api/src/services/user-provisioning.service.test.ts` (follow the pglite harness from `apps/api/src/services/resolve-users.test.ts`)

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/services/user-provisioning.service.test.ts`. Read `resolve-users.test.ts` for the exact harness (`createTestDb`, `insertUser` factory). Test the new exported helper directly:

```ts
// after seeding a user with NO membership:
await UserProvisioningService.ensureOwnWorkspace(ctx.db, user);
// expect: a workspace_members row now exists for `user` with role 'owner',
//   and the joined workspace name ends with "Home".
// Second call is a no-op: still exactly one membership.
```

Write real harness calls once you've read the reference test. (Note: `ensureOwnWorkspace` must be exported as a static method on `UserProvisioningService` so it's testable.)

- [ ] **Step 2: Run it (fails)**

Run: `pnpm --filter=api test -- user-provisioning`
Expected: FAIL — method not defined.

- [ ] **Step 3: Implement**

In `apps/api/src/services/user-provisioning.service.ts`, replace `ensureDefaultMembership` with a static method on the class (and update its two call sites to `await UserProvisioningService.ensureOwnWorkspace(db, user)`):

```ts
/**
 * Guarantee the user belongs to at least one workspace. If they already do,
 * no-op. In dev with DEFAULT_WORKSPACE_ID set, join that (legacy convenience).
 * Otherwise create a personal workspace they own.
 */
static async ensureOwnWorkspace(db: Database, user: UserRow): Promise<void> {
  const existing = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, user.id),
  });
  if (existing) return;

  const defaultId = process.env['DEFAULT_WORKSPACE_ID'];
  if (defaultId && process.env['NODE_ENV'] !== 'production') {
    const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, defaultId) });
    if (ws) {
      await db
        .insert(workspaceMembers)
        .values({ workspaceId: defaultId, userId: user.id, role: 'member', joinedAt: new Date() })
        .onConflictDoNothing();
      return;
    }
  }

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

Update the two `await ensureDefaultMembership(db, user.id)` calls to `await UserProvisioningService.ensureOwnWorkspace(db, user)` (they currently pass `user.id`; the new signature takes the `user` row — both call sites have `user` in scope). Delete the old `ensureDefaultMembership` function.

- [ ] **Step 4: Run it (passes) + existing tests**

Run: `pnpm --filter=api test -- user-provisioning && pnpm --filter=api test -- workspace`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/user-provisioning.service.ts apps/api/src/services/user-provisioning.service.test.ts
git commit -m "feat(api): new users get their own workspace (ensureOwnWorkspace)"
```

---

## Task 4: Invite create / preview / accept / revoke / list

**Files:**
- Modify: `apps/api/src/utils/validation.ts`, `apps/api/src/services/workspace.service.ts`, `apps/api/src/routers/workspace.ts`, `apps/api/src/routers/workspace.test.ts`

- [ ] **Step 1: Add validation schemas**

In `apps/api/src/utils/validation.ts`, near the existing `inviteSchema` (line ~98), add:

```ts
export const createInviteSchema = z.object({
  workspaceId: uuidSchema,
  email: z.string().email().optional(),
});
export const acceptInviteSchema = z.object({ token: z.string().min(1) });
export const invitePreviewSchema = z.object({ token: z.string().min(1) });
export const inviteIdSchema = z.object({ id: uuidSchema });
export const listInvitesSchema = z.object({ workspaceId: uuidSchema });
```

(Keep the old `inviteSchema` or remove it once the router stops using it — Step 4 replaces its use.)

- [ ] **Step 2: Write failing tests**

Replace the existing `describe('workspaceRouter — invite', ...)` block in `apps/api/src/routers/workspace.test.ts` with:

```ts
describe('workspaceRouter — invites', () => {
  it('owner can create an invite and a member cannot', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId); // owner
    const jordan = callerFor(ctx.db, world.jordan.clerkId); // member
    const res = await alex.workspace.createInvite({ workspaceId: world.workspace.id });
    expect(res.joinPath).toMatch(/^\/join\//);
    expect(res.invite.status).toBe('pending');
    await expect(
      jordan.workspace.createInvite({ workspaceId: world.workspace.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a signed-in stranger can accept an invite and becomes a member', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const { invite } = await alex.workspace.createInvite({ workspaceId: world.workspace.id });
    const stranger = await insertUser(ctx.db);
    const caller = callerFor(ctx.db, stranger.clerkId);

    const ws = await caller.workspace.acceptInvite({ token: invite.token });
    expect(ws.id).toBe(world.workspace.id);
    const members = await alex.workspace.members({ workspaceId: world.workspace.id });
    expect(members.map((m) => m.userId)).toContain(stranger.id);
  });

  it('rejects a revoked invite', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const { invite } = await alex.workspace.createInvite({ workspaceId: world.workspace.id });
    await alex.workspace.revokeInvite({ id: invite.id });
    const stranger = await insertUser(ctx.db);
    await expect(
      callerFor(ctx.db, stranger.clerkId).workspace.acceptInvite({ token: invite.token }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects accept when the workspace is full (6 members)', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    // workspace already has 2 (alex, jordan); add 4 more to reach 6
    for (let i = 0; i < 4; i++) {
      const u = await insertUser(ctx.db);
      const { invite } = await alex.workspace.createInvite({ workspaceId: world.workspace.id });
      await callerFor(ctx.db, u.clerkId).workspace.acceptInvite({ token: invite.token });
    }
    const seventh = await insertUser(ctx.db);
    const { invite } = await alex.workspace.createInvite({ workspaceId: world.workspace.id });
    await expect(
      callerFor(ctx.db, seventh.clerkId).workspace.acceptInvite({ token: invite.token }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('previews an invite without joining', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const { invite } = await alex.workspace.createInvite({ workspaceId: world.workspace.id });
    const stranger = await insertUser(ctx.db);
    const preview = await callerFor(ctx.db, stranger.clerkId).workspace.invitePreview({ token: invite.token });
    expect(preview).toMatchObject({ workspaceName: world.workspace.name, status: 'pending' });
  });

  it('lists pending invites for the owner', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.workspace.createInvite({ workspaceId: world.workspace.id });
    const list = await alex.workspace.listInvites({ workspaceId: world.workspace.id });
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.every((i) => i.status === 'pending')).toBe(true);
  });
});
```

- [ ] **Step 3: Run (fails)**

Run: `pnpm --filter=api test -- workspace`
Expected: FAIL — invite methods undefined.

- [ ] **Step 4: Implement the service methods**

In `apps/api/src/services/workspace.service.ts` add (import `workspaceInvites` from schema, `and`, `count` from drizzle-orm, `randomBytes` from `node:crypto`, error helpers `forbidden`, `conflict` — check `utils/errors.ts` for the exact `conflict`/`forbidden` factory names and use them; if no `conflict` exists, add one returning code `'CONFLICT'`):

```ts
const MAX_MEMBERS = 6;

private static async requireOwner(db: Database, userId: string, workspaceId: string): Promise<Result<true, AppError>> {
  const m = await db.query.workspaceMembers.findFirst({
    where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
  });
  if (!m) return { success: false, error: notFound('Workspace not found') };
  if (m.role !== 'owner') return { success: false, error: forbidden('Only the owner can manage invites') };
  return ok(true);
}

static async createInvite(db: Database, userId: string, input: { workspaceId: string; email?: string }): Promise<Result<{ invite: InviteRow; joinPath: string }, AppError>> {
  const owner = await this.requireOwner(db, userId, input.workspaceId);
  if (!owner.success) return owner;
  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const [invite] = await db.insert(workspaceInvites).values({
    workspaceId: input.workspaceId,
    token,
    email: input.email ?? null,
    invitedBy: userId,
    expiresAt,
  }).returning();
  if (!invite) return { success: false, error: internal('Invite creation failed') };
  // Optional email send (best-effort) is wired in a follow-up; copy-link is primary.
  return ok({ invite, joinPath: `/join/${token}` });
}

static async invitePreview(db: Database, _userId: string, token: string): Promise<Result<{ workspaceName: string; status: string }, AppError>> {
  const invite = await db.query.workspaceInvites.findFirst({ where: eq(workspaceInvites.token, token) });
  if (!invite) return { success: false, error: notFound('Invite not found') };
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, invite.workspaceId) });
  if (!ws) return { success: false, error: notFound('Invite not found') };
  return ok({ workspaceName: ws.name, status: invite.status });
}

static async acceptInvite(db: Database, userId: string, token: string): Promise<Result<WorkspaceRow, AppError>> {
  const invite = await db.query.workspaceInvites.findFirst({ where: eq(workspaceInvites.token, token) });
  if (!invite) return { success: false, error: notFound('Invite not found') };
  if (invite.status === 'revoked') return { success: false, error: notFound('Invite not found') };
  if (invite.status === 'pending' && invite.expiresAt < new Date()) {
    await db.update(workspaceInvites).set({ status: 'expired' }).where(eq(workspaceInvites.id, invite.id));
    return { success: false, error: notFound('Invite has expired') };
  }
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, invite.workspaceId) });
  if (!ws) return { success: false, error: notFound('Workspace not found') };

  const already = await db.query.workspaceMembers.findFirst({
    where: and(eq(workspaceMembers.workspaceId, invite.workspaceId), eq(workspaceMembers.userId, userId)),
  });
  if (already) {
    if (invite.status === 'pending') {
      await db.update(workspaceInvites).set({ status: 'accepted', acceptedBy: userId, acceptedAt: new Date() }).where(eq(workspaceInvites.id, invite.id));
    }
    return ok(ws);
  }

  const [{ value: memberCount }] = await db
    .select({ value: count() })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, invite.workspaceId));
  if (memberCount >= MAX_MEMBERS) return { success: false, error: conflict('Workspace is full') };

  await db.transaction(async (tx) => {
    await tx.insert(workspaceMembers).values({
      workspaceId: invite.workspaceId,
      userId,
      role: invite.role,
      joinedAt: new Date(),
    });
    await tx.update(workspaceInvites).set({ status: 'accepted', acceptedBy: userId, acceptedAt: new Date() }).where(eq(workspaceInvites.id, invite.id));
  });
  return ok(ws);
}

static async revokeInvite(db: Database, userId: string, id: string): Promise<Result<void, AppError>> {
  const invite = await db.query.workspaceInvites.findFirst({ where: eq(workspaceInvites.id, id) });
  if (!invite) return { success: false, error: notFound('Invite not found') };
  const owner = await this.requireOwner(db, userId, invite.workspaceId);
  if (!owner.success) return owner;
  await db.update(workspaceInvites).set({ status: 'revoked' }).where(eq(workspaceInvites.id, id));
  return ok(undefined);
}

static async listInvites(db: Database, userId: string, workspaceId: string): Promise<Result<InviteRow[], AppError>> {
  const owner = await this.requireOwner(db, userId, workspaceId);
  if (!owner.success) return owner;
  const rows = await db
    .select()
    .from(workspaceInvites)
    .where(and(eq(workspaceInvites.workspaceId, workspaceId), eq(workspaceInvites.status, 'pending')))
    .orderBy(desc(workspaceInvites.createdAt));
  return ok(rows);
}
```

Add `type InviteRow = typeof workspaceInvites.$inferSelect;` near the other row-type aliases, and ensure `desc`, `count`, `and` are imported from `drizzle-orm`, `randomBytes` from `node:crypto`, and `forbidden`/`conflict`/`internal` from `utils/errors` (add a `conflict` factory there if missing: `export const conflict = (message: string, details?) => ({ code: 'CONFLICT' as const, message, details });` matching the existing factory shape).

- [ ] **Step 5: Wire the router**

In `apps/api/src/routers/workspace.ts`, replace the `invite` stub and add procedures:

```ts
  createInvite: workspaceProcedure.input(createInviteSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.createInvite(ctx.db, ctx.userId, input));
  }),
  invitePreview: protectedProcedure.input(invitePreviewSchema).query(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.invitePreview(ctx.db, ctx.userId, input.token));
  }),
  acceptInvite: protectedProcedure.input(acceptInviteSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.acceptInvite(ctx.db, ctx.userId, input.token));
  }),
  revokeInvite: workspaceProcedure.input(inviteIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.revokeInvite(ctx.db, ctx.userId, input.id));
  }),
  listInvites: workspaceProcedure.input(listInvitesSchema).query(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.listInvites(ctx.db, ctx.userId, input.workspaceId));
  }),
```

Update the imports at the top to pull the new schemas (and drop `inviteSchema` if unused). Note `revokeInvite` uses `inviteIdSchema` which has no `workspaceId`, so it must NOT use `workspaceProcedure` (that middleware requires `workspaceId` in input) — use `protectedProcedure` for `revokeInvite` and let the service's `requireOwner` authorize. Likewise confirm `createInvite`/`listInvites` inputs carry `workspaceId` (they do) so `workspaceProcedure` is valid there.

- [ ] **Step 6: Run (passes)**

Run: `pnpm --filter=api test -- workspace`
Expected: PASS (all invite tests green).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/utils/validation.ts apps/api/src/services/workspace.service.ts apps/api/src/services/errors.ts apps/api/src/utils/errors.ts apps/api/src/routers/workspace.ts apps/api/src/routers/workspace.test.ts
git commit -m "feat(api): workspace invites — create/preview/accept/revoke/list (6-member cap)"
```

---

## Task 5: Web `WorkspaceProvider` + `useWorkspaceId` rewrite

**Files:**
- Create: `apps/web/src/lib/workspace-context.tsx` (+ test)
- Rewrite: `apps/web/src/lib/hooks/useWorkspaceId.ts`
- Modify: `apps/web/src/lib/providers.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/workspace-context.test.tsx`. Mock `@/lib/trpc` so `workspace.mine.useQuery` returns two workspaces, render a tiny consumer of `useWorkspace()`, assert it picks the persisted/first workspace and that `setActiveWorkspace` updates it + writes `localStorage['ls-active-workspace']`:

```tsx
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@/lib/trpc', () => ({
  trpc: { workspace: { mine: { useQuery: () => ({ data: [
    { workspace: { id: 'w1', name: 'A' }, role: 'owner' },
    { workspace: { id: 'w2', name: 'B' }, role: 'member' },
  ], isLoading: false }) } } },
}));

import { WorkspaceProvider, useWorkspace } from './workspace-context';

const wrapper = ({ children }: { children: ReactNode }) => <WorkspaceProvider>{children}</WorkspaceProvider>;

describe('workspace-context', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to the first workspace', () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    expect(result.current.workspaceId).toBe('w1');
    expect(result.current.workspaces).toHaveLength(2);
  });

  it('switches and persists', () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    act(() => result.current.setActiveWorkspace('w2'));
    expect(result.current.workspaceId).toBe('w2');
    expect(localStorage.getItem('ls-active-workspace')).toBe('w2');
  });

  it('honors a persisted choice', () => {
    localStorage.setItem('ls-active-workspace', 'w2');
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    expect(result.current.workspaceId).toBe('w2');
  });
});
```

- [ ] **Step 2: Run (fails)**

Run: `pnpm --filter=web test -- workspace-context`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the context**

Create `apps/web/src/lib/workspace-context.tsx`:

```tsx
'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { trpc } from '@/lib/trpc';

const STORAGE_KEY = 'ls-active-workspace';

interface MyWorkspace {
  workspace: { id: string; name: string };
  role: 'owner' | 'member';
}
interface WorkspaceContextValue {
  workspaceId: string | null;
  workspaces: MyWorkspace[];
  role: 'owner' | 'member' | null;
  setActiveWorkspace: (id: string) => void;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const query = trpc.workspace.mine.useQuery();
  const workspaces = (query.data ?? []) as MyWorkspace[];
  const [chosen, setChosen] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEY),
  );

  const valid = workspaces.find((w) => w.workspace.id === chosen);
  const workspaceId = (valid?.workspace.id ?? workspaces[0]?.workspace.id) ?? null;
  const role = workspaces.find((w) => w.workspace.id === workspaceId)?.role ?? null;

  const setActiveWorkspace = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setChosen(id);
  }, []);

  const value = useMemo(
    () => ({ workspaceId, workspaces, role, setActiveWorkspace, isLoading: query.isLoading }),
    [workspaceId, workspaces, role, setActiveWorkspace, query.isLoading],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return ctx;
}
```

- [ ] **Step 4: Rewrite `useWorkspaceId` to read the context (tolerant)**

Replace `apps/web/src/lib/hooks/useWorkspaceId.ts` with:

```ts
'use client';

import { useContext } from 'react';
import { useWorkspace } from '@/lib/workspace-context';

/**
 * The active workspace id, from WorkspaceProvider. Returns null while loading
 * or when the user has no workspace. Signature unchanged for existing callers.
 */
export function useWorkspaceId(): string | null {
  return useWorkspace().workspaceId;
}
```

(Existing component tests mock `@/lib/hooks/useWorkspaceId` directly, so they are unaffected.)

- [ ] **Step 5: Mount the provider**

In `apps/web/src/lib/providers.tsx`, import `WorkspaceProvider` and place it INSIDE `TRPCProvider` (it queries tRPC) and around `ToastProvider`/children:

```tsx
import { WorkspaceProvider } from './workspace-context';
// ...
        <NavPrefsProvider>
          <TRPCProvider>
            <WorkspaceProvider>
              <ToastProvider>{children}</ToastProvider>
            </WorkspaceProvider>
          </TRPCProvider>
        </NavPrefsProvider>
```

- [ ] **Step 6: Run + typecheck**

Run: `pnpm --filter=web test -- workspace-context && pnpm --filter=web typecheck`
Expected: PASS / clean. If typecheck flags the `(app)/layout.tsx` or any server component importing `useWorkspaceId`, ensure those are client components (they already are — the hook was always client-only via env, but confirm).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/workspace-context.tsx apps/web/src/lib/workspace-context.test.tsx apps/web/src/lib/hooks/useWorkspaceId.ts apps/web/src/lib/providers.tsx
git commit -m "feat(web): WorkspaceProvider + switcher data; replace env-hardcoded active workspace"
```

---

## Task 6: Workspace switcher

**Files:**
- Create: `apps/web/src/components/app-shell/WorkspaceSwitcher.tsx` (+ `.module.css`, + test)
- Modify: `apps/web/src/components/app-shell/NavigationSidebar.tsx` (place the switcher)

- [ ] **Step 1: Write the failing test**

Create `WorkspaceSwitcher.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const setActiveWorkspace = vi.fn();
vi.mock('@/lib/workspace-context', () => ({
  useWorkspace: () => ({
    workspaceId: 'w1',
    workspaces: [
      { workspace: { id: 'w1', name: 'Home' }, role: 'owner' },
      { workspace: { id: 'w2', name: 'Beach House' }, role: 'member' },
    ],
    role: 'owner',
    setActiveWorkspace,
    isLoading: false,
  }),
}));

import { WorkspaceSwitcher } from './WorkspaceSwitcher';

describe('WorkspaceSwitcher', () => {
  it('shows the active workspace and switches', async () => {
    render(<WorkspaceSwitcher />);
    await userEvent.selectOptions(screen.getByLabelText(/workspace/i), 'w2');
    expect(setActiveWorkspace).toHaveBeenCalledWith('w2');
  });
});
```

- [ ] **Step 2: Run (fails)** — `pnpm --filter=web test -- WorkspaceSwitcher` → module not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/components/app-shell/WorkspaceSwitcher.tsx`:

```tsx
'use client';

import { useWorkspace } from '@/lib/workspace-context';
import styles from './WorkspaceSwitcher.module.css';

export function WorkspaceSwitcher() {
  const { workspaceId, workspaces, setActiveWorkspace } = useWorkspace();
  if (workspaces.length <= 1) {
    return <span className={styles.single}>{workspaces[0]?.workspace.name ?? ''}</span>;
  }
  return (
    <label className={styles.wrap}>
      <span className={styles.srOnly}>Workspace</span>
      <select
        className={styles.select}
        value={workspaceId ?? ''}
        onChange={(e) => setActiveWorkspace(e.target.value)}
      >
        {workspaces.map((w) => (
          <option key={w.workspace.id} value={w.workspace.id}>
            {w.workspace.name}
          </option>
        ))}
      </select>
    </label>
  );
}
```

Create `WorkspaceSwitcher.module.css` with token-based styling (use `--ls-*` tokens):

```css
.wrap { display: block; }
.select {
  width: 100%;
  font: inherit;
  font-size: var(--ls-text-sm);
  color: var(--ls-text-primary);
  background: var(--ls-surface-card);
  border: 1px solid var(--ls-surface-border);
  border-radius: var(--ls-radius-md);
  padding: 0.3rem 0.5rem;
}
.single {
  font-size: var(--ls-text-sm);
  font-weight: 600;
  color: var(--ls-text-secondary);
}
.srOnly {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
```

- [ ] **Step 4: Place it in the sidebar**

Read `apps/web/src/components/app-shell/NavigationSidebar.tsx`. Import `WorkspaceSwitcher` and render it just below the `.brand` link (above the `<nav>`), so it sits at the top of the sidebar. Don't disturb the brand/nav/footer structure.

- [ ] **Step 5: Run + typecheck** — `pnpm --filter=web test -- WorkspaceSwitcher && pnpm --filter=web typecheck` → PASS / clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/app-shell/WorkspaceSwitcher.tsx apps/web/src/components/app-shell/WorkspaceSwitcher.module.css apps/web/src/components/app-shell/WorkspaceSwitcher.test.tsx apps/web/src/components/app-shell/NavigationSidebar.tsx
git commit -m "feat(web): workspace switcher in the sidebar"
```

---

## Task 7: `/join/[token]` page

**Files:**
- Create: `apps/web/src/app/join/[token]/page.tsx` (+ `.module.css`, + test)

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/join/[token]/page.test.tsx`. Mock `next/navigation` (`useParams` → `{ token: 'tok' }`, `useRouter` → `{ push }`), mock `@/lib/trpc` (`workspace.invitePreview.useQuery` → `{ data: { workspaceName: 'Beach House', status: 'pending' } }`, `workspace.acceptInvite.useMutation` → mutate spy), and mock `@/lib/workspace-context` (`useWorkspace` → `{ setActiveWorkspace }`). Assert the workspace name renders and clicking "Join" calls `acceptInvite` with `{ token: 'tok' }`:

```tsx
// shape — write with real mocks:
// render(<JoinPage />)
// expect(screen.getByText(/Beach House/)).toBeInTheDocument()
// await userEvent.click(screen.getByRole('button', { name: /join/i }))
// expect(acceptMutate).toHaveBeenCalledWith({ token: 'tok' })
```

- [ ] **Step 2: Run (fails)** — `pnpm --filter=web test -- "join"` → module not found.

- [ ] **Step 3: Implement the page**

Create `apps/web/src/app/join/[token]/page.tsx` (client component). It reads `token` from `useParams`, fetches `invitePreview`, and on Join calls `acceptInvite` then `setActiveWorkspace(ws.id)` and routes to `/dashboard`. Handle `status !== 'pending'` and error states with a clear message + a link to `/dashboard`. Use shared UI (`Button`, `LoadingSpinner`, `EmptyState`, `useToast`). Pattern:

```tsx
'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button, EmptyState, LoadingSpinner, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspace } from '@/lib/workspace-context';
import styles from './join.module.css';

export default function JoinPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const toast = useToast();
  const { setActiveWorkspace } = useWorkspace();
  const preview = trpc.workspace.invitePreview.useQuery({ token }, { enabled: Boolean(token) });
  const accept = trpc.workspace.acceptInvite.useMutation({
    onSuccess: (ws) => {
      setActiveWorkspace(ws.id);
      toast.success(`Joined ${ws.name}`);
      router.push('/dashboard');
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  if (preview.isLoading) return <div className={styles.center}><LoadingSpinner size="lg" label="Loading invite" /></div>;
  if (preview.isError || !preview.data || preview.data.status !== 'pending') {
    return <div className={styles.center}><EmptyState title="This invite isn't available" description="It may have been used, revoked, or expired." /></div>;
  }
  return (
    <div className={styles.center}>
      <h1 className={styles.title}>Join {preview.data.workspaceName}</h1>
      <Button onClick={() => accept.mutate({ token })} disabled={accept.isPending}>
        {accept.isPending ? 'Joining…' : 'Join workspace'}
      </Button>
    </div>
  );
}
```

Create `join.module.css` with a simple centered layout using `--ls-*` tokens. Note: this route is under `app/join/...`, OUTSIDE the `(app)` group, so it does not render the app shell. Clerk's `middleware.ts` already protects routes — confirm `/join` requires auth (it should, since only signed-in users can accept); if `middleware.ts` has an explicit public-route allowlist, ensure `/join` is NOT in it so unauthenticated users get redirected to sign-in and back.

- [ ] **Step 4: Run + typecheck** — `pnpm --filter=web test -- "join" && pnpm --filter=web typecheck` → PASS / clean.

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/join/[token]/"
git commit -m "feat(web): /join/[token] page to accept a workspace invite"
```

---

## Task 8: Invite controls in Settings → Workspace

**Files:**
- Modify: `apps/web/src/components/settings/WorkspaceSettings.tsx` (+ test)

- [ ] **Step 1: Write the failing test**

Update/extend `apps/web/src/components/settings/WorkspaceSettings.test.tsx` (read it first). Mock `@/lib/trpc` with `workspace.createInvite.useMutation` (mutate returns `{ joinPath: '/join/tok', invite: {...} }` via onSuccess), `workspace.listInvites.useQuery` (→ one pending invite), `workspace.revokeInvite.useMutation`. Mock `navigator.clipboard.writeText`. Pass an `currentUserRole="owner"` prop (new). Assert: an "Invite" button exists for owners; clicking it calls `createInvite` and writes a link to the clipboard; a pending invite row has a "Revoke" button that calls `revokeInvite`.

- [ ] **Step 2: Run (fails)** — `pnpm --filter=web test -- WorkspaceSettings`.

- [ ] **Step 3: Implement**

Read the current `apps/web/src/components/settings/WorkspaceSettings.tsx` (it currently shows the members list + a disabled "Invite a partner" button). Add a `role` prop (the current user's role, from `useWorkspace().role` at the page level — wire it through from `settings/page.tsx`). For owners, replace the disabled button with a working one:
- `createInvite` mutation; `onSuccess` → build the full URL (`${window.location.origin}${res.joinPath}`), `navigator.clipboard.writeText(url)`, toast "Invite link copied".
- Show `listInvites` results (enabled only for owners) as rows with their email/created date + a Revoke button (`revokeInvite` → invalidate `listInvites`).
- Non-owners: keep the members list, no invite controls.

Wire the `role` through in `apps/web/src/app/(app)/settings/page.tsx`: read `const { role } = useWorkspace();` and pass `role={role}` to `<WorkspaceSettings .../>`. (The settings page already passes `currentUserId`.)

- [ ] **Step 4: Run + typecheck** — `pnpm --filter=web test -- WorkspaceSettings && pnpm --filter=web typecheck` → PASS / clean. The settings page test (`settings/page.test.tsx`) will need the `workspace.mine`/`useWorkspace` mock now that the page reads `useWorkspace`; update that test's mocks (wrap in `WorkspaceProvider` or mock `@/lib/workspace-context`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/settings/WorkspaceSettings.tsx apps/web/src/components/settings/WorkspaceSettings.test.tsx "apps/web/src/app/(app)/settings/page.tsx" "apps/web/src/app/(app)/settings/page.test.tsx"
git commit -m "feat(web): owner invite controls (create+copy link, revoke) in Settings"
```

---

## Task 9: Full verification

- [ ] **Step 1: Build packages consumed downstream**

Run: `pnpm --filter=@lifesync/shared-types build && pnpm --filter=@lifesync/ui build`
Expected: success.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: all packages green, including new api invite/mine/provisioning tests and web workspace-context/switcher/join/WorkspaceSettings tests. Fix any existing web test that renders a component now depending on `useWorkspace` without the provider/mock (most mock `useWorkspaceId` already; the settings page test is the known one — Task 8 Step 4).

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck` (all 5 packages) and `pnpm --filter=web exec eslint "src" --quiet && pnpm --filter=api exec eslint "src" --quiet`.
Expected: clean.

- [ ] **Step 4: Manual smoke (optional, if running locally + DB migrated)**

Apply `0004` (`pnpm db:migrate` will NOT pick it up — it's a hand-written migration like 0002/0003; apply via Supabase as done previously). Then: as owner, Settings → Invite → copy link → open `/join/<token>` in another session → Join → confirm the new member appears and the switcher lists both workspaces.

---

## Self-Review Notes

- **Spec coverage:** invites table (T1) ✓; `mine` + active-workspace data (T2) ✓; personal-workspace provisioning (T3) ✓; create/preview/accept/revoke/list + 6-member cap + expiry/revoke (T4) ✓; WorkspaceProvider/switcher replacing the env hardcode (T5/T6) ✓; join page (T7) ✓; owner invite UI (T8) ✓; tests each layer ✓; non-goals (owner-only inviter, no visibility change, optional email, no mobile) respected ✓.
- **Auth nuance:** `revokeInvite` uses `protectedProcedure` (its input has no `workspaceId`, so `workspaceProcedure` can't apply) — authorized via `requireOwner` in the service. `acceptInvite`/`invitePreview`/`mine` are `protectedProcedure` (caller may not be a member yet). `createInvite`/`listInvites` carry `workspaceId` → `workspaceProcedure`.
- **Type consistency:** `MyWorkspace { workspace, role }` is identical in `workspace.service.ts` and `workspace-context.tsx`; `createInvite` returns `{ invite, joinPath }` used by both the test and the Settings UI; `invitePreview` returns `{ workspaceName, status }` used by the join page; `acceptInvite` returns the workspace row (`{ id, name, ... }`).
- **Migration:** `0004` is hand-written (not in drizzle's journal), so like `0002`/`0003` it must be applied to live via Supabase, not `pnpm db:migrate` — called out in T9 Step 4.
- **`errors.ts` location:** Task 4 references adding a `conflict` factory — confirm whether error factories live in `apps/api/src/utils/errors.ts` (per CLAUDE.md) and add it there only if missing; adjust the `git add` path accordingly (the plan lists both `services/errors.ts` and `utils/errors.ts` defensively — use the real one).
```
