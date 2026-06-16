# Workspace Membership — Slice B: Roles & Member Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let owners promote/demote members and remove members, let members leave, all guarded so a workspace always keeps ≥1 owner.

**Architecture:** Three new `WorkspaceService` methods (`changeRole`/`removeMember`/`leave`) backed by a `countOwners` guard and the existing `requireOwner`; thin `workspaceProcedure` router procedures; the existing read-only members list in `WorkspaceSettings` becomes interactive. No DB migration (reuses `workspace_members.role`).

**Tech Stack:** Drizzle + Postgres (pglite tests), tRPC v11, Next.js client components, Vitest + RTL + pglite integration tests.

**Spec:** `docs/superpowers/specs/2026-06-16-workspace-roles-design.md`

**Epic:** Slice B of A→B→C (A shipped; C = visibility). No migration, no email, no content reassignment.

**IMPORTANT for all tasks:** Do NOT run `pnpm format` / Prettier — on this Windows checkout it rewrites line endings across the whole repo and creates massive CRLF churn. Only edit the files listed per task.

---

## File Structure
- `apps/api/src/utils/validation.ts` — `changeRoleSchema`, `removeMemberSchema`, `leaveSchema`.
- `apps/api/src/services/workspace.service.ts` — `countOwners` (private), `changeRole`, `removeMember`, `leave`.
- `apps/api/src/routers/workspace.ts` — three procedures.
- `apps/api/src/routers/workspace.test.ts` — new tests.
- `apps/web/src/components/settings/WorkspaceSettings.tsx` (+ `.module.css`, + test) — member management UI.

---

## Task 1: Role/remove/leave service + router (backend)

**Files:** `apps/api/src/utils/validation.ts`, `apps/api/src/services/workspace.service.ts`, `apps/api/src/routers/workspace.ts`, `apps/api/src/routers/workspace.test.ts`

- [ ] **Step 1: Add validation schemas**

In `apps/api/src/utils/validation.ts`, near the other workspace/invite schemas, add:

```ts
export const changeRoleSchema = z.object({
  workspaceId: uuidSchema,
  targetUserId: uuidSchema,
  role: z.enum(['owner', 'member']),
});
export const removeMemberSchema = z.object({ workspaceId: uuidSchema, targetUserId: uuidSchema });
export const leaveSchema = z.object({ workspaceId: uuidSchema });
```

- [ ] **Step 2: Write the failing tests**

Add this describe block to `apps/api/src/routers/workspace.test.ts` (harness provides `ctx`, `world` [world.workspace, world.alex {id,clerkId} = owner, world.jordan {id,clerkId} = member], `callerFor`, `insertUser`):

```ts
describe('workspaceRouter — role & membership management', () => {
  it('owner promotes a member to owner; member cannot change roles', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId); // owner
    const jordan = callerFor(ctx.db, world.jordan.clerkId); // member
    const updated = await alex.workspace.changeRole({
      workspaceId: world.workspace.id,
      targetUserId: world.jordan.id,
      role: 'owner',
    });
    expect(updated.role).toBe('owner');
    await expect(
      jordan.workspace.changeRole({
        workspaceId: world.workspace.id,
        targetUserId: world.alex.id,
        role: 'member',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('blocks demoting the last owner', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await expect(
      alex.workspace.changeRole({
        workspaceId: world.workspace.id,
        targetUserId: world.alex.id,
        role: 'member',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('owner removes a member; blocks removing the last owner', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    await alex.workspace.removeMember({ workspaceId: world.workspace.id, targetUserId: world.jordan.id });
    const members = await alex.workspace.members({ workspaceId: world.workspace.id });
    expect(members.map((m) => m.userId)).not.toContain(world.jordan.id);

    await expect(
      alex.workspace.removeMember({ workspaceId: world.workspace.id, targetUserId: world.alex.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('a member can leave; the last owner cannot', async () => {
    const jordan = callerFor(ctx.db, world.jordan.clerkId); // member
    await jordan.workspace.leave({ workspaceId: world.workspace.id });
    expect(await jordan.workspace.mine()).toEqual([]);

    const alex = callerFor(ctx.db, world.alex.clerkId); // now the only owner & only member
    await expect(
      alex.workspace.leave({ workspaceId: world.workspace.id }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('a non-last owner can leave', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    // promote jordan so there are two owners, then alex leaves
    await alex.workspace.changeRole({
      workspaceId: world.workspace.id,
      targetUserId: world.jordan.id,
      role: 'owner',
    });
    await alex.workspace.leave({ workspaceId: world.workspace.id });
    const jordan = callerFor(ctx.db, world.jordan.clerkId);
    const members = await jordan.workspace.members({ workspaceId: world.workspace.id });
    expect(members.map((m) => m.userId)).not.toContain(world.alex.id);
  });
});
```

- [ ] **Step 3: Run (fails)**

Run: `pnpm --filter=api test -- workspace`
Expected: FAIL — `changeRole`/`removeMember`/`leave` undefined.

- [ ] **Step 4: Implement the service methods**

In `apps/api/src/services/workspace.service.ts` (which already imports `eq`, `and`, `count` from drizzle-orm, `workspaceMembers`/`workspaces` from schema, `ok`/`notFound`/`forbidden`/`conflict`/`internal` error helpers, and aliases `type MemberRow = typeof workspaceMembers.$inferSelect`), add inside the `WorkspaceService` class:

```ts
  private static async countOwners(db: Database, workspaceId: string): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, 'owner')));
    return row?.value ?? 0;
  }

  static async changeRole(
    db: Database,
    userId: string,
    input: { workspaceId: string; targetUserId: string; role: 'owner' | 'member' },
  ): Promise<Result<MemberRow, AppError>> {
    const owner = await this.requireOwner(db, userId, input.workspaceId);
    if (!owner.success) return owner;

    const target = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ),
    });
    if (!target) return { success: false, error: notFound('Member not found') };
    if (target.role === input.role) return ok(target);

    if (target.role === 'owner' && input.role === 'member' && (await this.countOwners(db, input.workspaceId)) <= 1) {
      return { success: false, error: conflict('Promote another member to owner before stepping down') };
    }

    const [updated] = await db
      .update(workspaceMembers)
      .set({ role: input.role })
      .where(and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ))
      .returning();
    if (!updated) return { success: false, error: internal('Role update failed') };
    return ok(updated);
  }

  static async removeMember(
    db: Database,
    userId: string,
    input: { workspaceId: string; targetUserId: string },
  ): Promise<Result<void, AppError>> {
    const owner = await this.requireOwner(db, userId, input.workspaceId);
    if (!owner.success) return owner;

    const target = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ),
    });
    if (!target) return { success: false, error: notFound('Member not found') };
    if (target.role === 'owner' && (await this.countOwners(db, input.workspaceId)) <= 1) {
      return { success: false, error: conflict('Cannot remove the last owner') };
    }

    await db
      .delete(workspaceMembers)
      .where(and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, input.targetUserId),
      ));
    return ok(undefined);
  }

  static async leave(
    db: Database,
    userId: string,
    input: { workspaceId: string },
  ): Promise<Result<void, AppError>> {
    const me = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    });
    if (!me) return { success: false, error: notFound('Membership not found') };
    if (me.role === 'owner' && (await this.countOwners(db, input.workspaceId)) <= 1) {
      return { success: false, error: conflict('Make someone else an owner before leaving') };
    }

    await db
      .delete(workspaceMembers)
      .where(and(
        eq(workspaceMembers.workspaceId, input.workspaceId),
        eq(workspaceMembers.userId, userId),
      ));
    return ok(undefined);
  }
```

(If any of `and`/`count`/`conflict`/`forbidden`/`internal` is NOT already imported in this file, add it — confirm by reading the import block first; slice A added `and`/`count`/`conflict`.)

- [ ] **Step 5: Wire the router**

In `apps/api/src/routers/workspace.ts`, import the three schemas and add (all `workspaceProcedure` — every input carries `workspaceId`):

```ts
  changeRole: workspaceProcedure.input(changeRoleSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.changeRole(ctx.db, ctx.userId, input));
  }),
  removeMember: workspaceProcedure.input(removeMemberSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.removeMember(ctx.db, ctx.userId, input));
  }),
  leave: workspaceProcedure.input(leaveSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await WorkspaceService.leave(ctx.db, ctx.userId, input));
  }),
```

- [ ] **Step 6: Run (passes) + typecheck**

Run: `pnpm --filter=api test -- workspace && pnpm --filter=api typecheck`
Expected: PASS / clean.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/utils/validation.ts apps/api/src/services/workspace.service.ts apps/api/src/routers/workspace.ts apps/api/src/routers/workspace.test.ts
git commit -m "feat(api): workspace role management — changeRole/removeMember/leave (last-owner guarded)"
```

---

## Task 2: Member management UI in Settings

**Files:** `apps/web/src/components/settings/WorkspaceSettings.tsx` (+ `WorkspaceSettings.module.css`, + `WorkspaceSettings.test.tsx`)

- [ ] **Step 1: Extend the test**

Read the current `apps/web/src/components/settings/WorkspaceSettings.test.tsx` first. Extend its `@/lib/trpc` mock to add: `useUtils` → also `{ workspace: { members: { invalidate: vi.fn() }, mine: { invalidate: vi.fn() }, listInvites: { invalidate: vi.fn() } } }`; and mutations `workspace.changeRole.useMutation` / `workspace.removeMember.useMutation` / `workspace.leave.useMutation` each `(o) => ({ mutate: <spy>, isPending: false })` (capture the spies). Mock `next/navigation`'s `useRouter` → `{ push: vi.fn() }` (the component will use it on leave). Use a two-member fixture: `[{ userId:'u1', role:'owner', user:{id:'u1',displayName:'Alex'} }, { userId:'u2', role:'member', user:{id:'u2',displayName:'Jordan'} }]` with `currentUserId='u1'`.

Add tests:
- Owner view (`role="owner"`, currentUserId `u1`): Jordan's row has a "Make owner" control and a "Remove" control; clicking "Make owner" calls `changeRole` with `{ workspaceId, targetUserId:'u2', role:'owner' }`; clicking "Remove" calls `removeMember` with `{ workspaceId, targetUserId:'u2' }`.
- Last-owner guard: with a single owner (u1), Alex's own row shows NO demote/remove, and the "Leave workspace" button is disabled (or absent) for the sole owner.
- Member view (`role="member"`, currentUserId `u2`): no Make owner/Remove controls anywhere; a "Leave workspace" button is present and calls `leave` with `{ workspaceId }`.

- [ ] **Step 2: Run (fails)**

Run: `pnpm --filter=web test -- WorkspaceSettings`
Expected: FAIL — new controls/handlers don't exist yet.

- [ ] **Step 3: Implement the UI**

Edit `apps/web/src/components/settings/WorkspaceSettings.tsx`. Add `useRouter` from `next/navigation`, the three mutations, and an `ownerCount`. The member-list `<li>` gains role/remove controls (owner view) and there's a Leave button. Replace the component body's relevant parts so it reads:

```tsx
'use client';

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { useRouter } from 'next/navigation';
import { Avatar, Badge, Button, useToast } from '@lifesync/ui';
import { SectionCard } from './SectionCard';
import { trpc } from '@/lib/trpc';
import styles from './WorkspaceSettings.module.css';

type Workspace = inferRouterOutputs<AppRouter>['workspace']['get'];
type Member = inferRouterOutputs<AppRouter>['workspace']['members'][number];

export interface WorkspaceSettingsProps {
  workspace: Workspace | undefined;
  members: Member[];
  currentUserId: string;
  role: 'owner' | 'member' | null;
}

export function WorkspaceSettings({ workspace, members, currentUserId, role }: WorkspaceSettingsProps) {
  const toast = useToast();
  const router = useRouter();
  const utils = trpc.useUtils();
  const isOwner = role === 'owner';
  const ownerCount = members.filter((m) => m.role === 'owner').length;
  const wsId = workspace?.id;

  const refreshMembers = () => {
    void utils.workspace.members.invalidate();
    void utils.workspace.mine.invalidate();
  };
  const onError = (e: { message: string }) => toast.error(e.message);

  const createInvite = trpc.workspace.createInvite.useMutation({
    onSuccess: (res) => {
      const url = `${window.location.origin}${res.joinPath}`;
      void navigator.clipboard.writeText(url).then(() => toast.success('Invite link copied'));
      void utils.workspace.listInvites.invalidate();
    },
    onError,
  });
  const listInvitesQuery = trpc.workspace.listInvites.useQuery(
    { workspaceId: wsId ?? '' },
    { enabled: isOwner && Boolean(wsId) },
  );
  const revokeInvite = trpc.workspace.revokeInvite.useMutation({
    onSuccess: () => void utils.workspace.listInvites.invalidate(),
    onError,
  });

  const changeRole = trpc.workspace.changeRole.useMutation({
    onSuccess: () => { refreshMembers(); toast.success('Role updated'); },
    onError,
  });
  const removeMember = trpc.workspace.removeMember.useMutation({
    onSuccess: () => { refreshMembers(); toast.success('Member removed'); },
    onError,
  });
  const leave = trpc.workspace.leave.useMutation({
    onSuccess: () => { refreshMembers(); toast.success('You left the workspace'); router.push('/dashboard'); },
    onError,
  });

  const invites = listInvitesQuery.data ?? [];
  const busy = changeRole.isPending || removeMember.isPending || leave.isPending;
  const canLeave = role === 'member' || (isOwner && ownerCount > 1);

  return (
    <SectionCard title="Workspace">
      <div className={styles.name}>{workspace?.name ?? '—'}</div>

      <ul className={styles.members}>
        {members.map((m) => {
          const isSelf = m.user.id === currentUserId;
          const isLastOwner = m.role === 'owner' && ownerCount <= 1;
          const showManage = isOwner && !isSelf && wsId;
          return (
            <li key={m.user.id} className={styles.member}>
              <Avatar name={m.user.displayName} />
              <span className={styles.memberName}>
                {m.user.displayName}
                {isSelf ? ' (you)' : ''}
              </span>
              <Badge tone={m.role === 'owner' ? 'primary' : 'neutral'}>
                {m.role === 'owner' ? 'Owner' : 'Member'}
              </Badge>
              {showManage ? (
                <span className={styles.memberActions}>
                  {!isLastOwner ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        changeRole.mutate({
                          workspaceId: wsId,
                          targetUserId: m.user.id,
                          role: m.role === 'owner' ? 'member' : 'owner',
                        })
                      }
                    >
                      {m.role === 'owner' ? 'Make member' : 'Make owner'}
                    </Button>
                  ) : null}
                  {!isLastOwner ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => removeMember.mutate({ workspaceId: wsId, targetUserId: m.user.id })}
                    >
                      Remove
                    </Button>
                  ) : null}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      {isOwner ? (
        <div className={styles.inviteSection}>
          <div className={styles.invite}>
            <Button
              variant="ghost"
              size="sm"
              disabled={createInvite.isPending || !workspace}
              onClick={() => {
                if (!workspace) return;
                createInvite.mutate({ workspaceId: workspace.id });
              }}
            >
              Invite
            </Button>
          </div>

          {invites.length > 0 ? (
            <ul className={styles.invites}>
              {invites.map((invite) => (
                <li key={invite.id} className={styles.inviteRow}>
                  <span className={styles.inviteEmail}>{invite.email ?? 'Anyone with the link'}</span>
                  <span className={styles.inviteDate}>
                    {new Date(invite.createdAt).toLocaleDateString()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revokeInvite.isPending}
                    onClick={() => revokeInvite.mutate({ id: invite.id })}
                  >
                    Revoke
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {wsId ? (
        <div className={styles.leaveRow}>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || !canLeave}
            onClick={() => leave.mutate({ workspaceId: wsId })}
          >
            Leave workspace
          </Button>
          {isOwner && ownerCount <= 1 ? (
            <span className={styles.leaveHint}>Make another member an owner before leaving.</span>
          ) : null}
        </div>
      ) : null}
    </SectionCard>
  );
}
```

- [ ] **Step 4: Add styles**

Append to `apps/web/src/components/settings/WorkspaceSettings.module.css`:

```css
.memberActions {
  display: inline-flex;
  gap: var(--ls-space-1);
  margin-left: var(--ls-space-2);
}
.leaveRow {
  margin-top: var(--ls-space-3);
  padding-top: var(--ls-space-3);
  border-top: 1px solid var(--ls-surface-border);
  display: flex;
  align-items: center;
  gap: var(--ls-space-2);
  flex-wrap: wrap;
}
.leaveHint {
  font-size: var(--ls-text-xs);
  color: var(--ls-text-tertiary);
}
```

- [ ] **Step 5: Run (passes) + typecheck**

Run: `pnpm --filter=web test -- WorkspaceSettings && pnpm --filter=web typecheck`
Expected: PASS / clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/settings/WorkspaceSettings.tsx apps/web/src/components/settings/WorkspaceSettings.module.css apps/web/src/components/settings/WorkspaceSettings.test.tsx
git commit -m "feat(web): member management (role, remove, leave) in Settings"
```

---

## Task 3: Full verification

- [ ] **Step 1: Build downstream packages**

Run: `pnpm --filter=@lifesync/shared-types build && pnpm --filter=@lifesync/ui build`
Expected: success.

- [ ] **Step 2: Full suite**

Run: `pnpm test`
Expected: all green (api gains the role/remove/leave tests; web WorkspaceSettings tests updated).

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck` and `pnpm --filter=web exec eslint "src" --quiet && pnpm --filter=api exec eslint "src" --quiet`.
Expected: clean.

- [ ] **Step 4: Manual smoke (optional, local)**

As an owner with a second member: Settings → Workspace → Make owner / Make member toggles the badge; Remove drops the member; the sole owner sees no demote/remove on themselves and a disabled Leave with the hint; a member sees only Leave and leaving returns them to their own workspace.

---

## Self-Review Notes
- **Spec coverage:** `countOwners` guard (T1) ✓; changeRole/removeMember/leave with last-owner guards (T1) ✓; owner-only via `requireOwner` (T1) ✓; interactive members list — role toggle, remove, guarded leave, member-only-leave (T2) ✓; tests both layers (T1/T2) ✓; non-goals (no migration, no transfer action, no reassignment, no email) respected ✓.
- **Type consistency:** service method input shapes match the Zod schemas (`{workspaceId,targetUserId,role}` / `{workspaceId,targetUserId}` / `{workspaceId}`); `changeRole` returns `MemberRow`; router passes `input` straight through; the web mutations call `changeRole({workspaceId,targetUserId,role})`, `removeMember({workspaceId,targetUserId})`, `leave({workspaceId})` matching the procedures.
- **Guard parity:** the UI mirrors the server's last-owner rule via `ownerCount` so disabled/hidden controls match what the API would reject; the server remains the source of truth.
- **No migration:** reuses `workspace_members.role`; nothing to apply to live DB for this slice.
