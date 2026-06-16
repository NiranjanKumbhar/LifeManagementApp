# Workspace Membership — Slice B: Roles & Member Management — Design

> **Date:** 2026-06-16
> **Status:** Approved (design), pending implementation plan
> **Epic:** Workspace membership & sharing — **A (invites & joining, shipped) → B (this) → C (visibility & encapsulation)**.
> **Scope:** `apps/api` + `apps/web`. No `apps/mobile`. No DB migration (uses the existing `workspace_members.role`).

## Context / current state (after slice A)

- `workspace_members` = `{ workspaceId, userId, role: 'owner' | 'member', invitedAt, joinedAt }`, unique on `(workspaceId, userId)`.
- `WorkspaceService` (slice A): `get`, `create` (creator → owner), `members`, `mine`, and invites
  (`createInvite`/`invitePreview`/`acceptInvite`/`revokeInvite`/`listInvites`). A private
  `requireOwner(db, userId, workspaceId)` helper already exists (returns `NOT_FOUND` for a
  non-member, `FORBIDDEN` for a member who isn't an owner).
- Web: `WorkspaceProvider`/`useWorkspace` (active workspace from `workspace.mine`, persisted in
  `localStorage`, falls back to the first workspace if the active one disappears), a sidebar
  `WorkspaceSwitcher`, and `WorkspaceSettings` (members list + owner invite controls; takes a
  `role` prop).
- `acceptInvite` already enforces a 6-member cap. New users get their own workspace
  (`ensureOwnWorkspace`).

## Decisions (from brainstorming)

- **Multiple owners:** owners can promote a member to owner and demote owners to member.
- **Actions:** change role, remove member, leave workspace.
- **Last-owner protection:** a workspace must always have ≥ 1 owner.
- **Removed/left member's content stays:** attribution (`created_by`, `owner_id`, `added_by`, …)
  is preserved; removal only revokes access (deletes the `workspace_members` row).

## Design

### 1. API — `WorkspaceService` methods

Add a private guard and three operations. Reuse the existing `requireOwner`.

```ts
private static async countOwners(db: Database, workspaceId: string): Promise<number>;
```
Counts `workspace_members` rows with `role = 'owner'` in the workspace.

- **`changeRole(db, userId, { workspaceId, targetUserId, role })`** → `Result<MemberRow, AppError>`
  - `requireOwner(userId)` first.
  - Load the target membership (must exist in this workspace, else `NOT_FOUND`).
  - If the target is currently `owner` and `role === 'member'` (a demotion) and
    `countOwners() <= 1` → `conflict('Promote another member to owner before stepping down')`.
  - No-op fast-path if the role is unchanged (return the existing row).
  - Update `workspace_members.role`; return the updated row.

- **`removeMember(db, userId, { workspaceId, targetUserId })`** → `Result<void, AppError>`
  - `requireOwner(userId)` first.
  - Load the target membership (else `NOT_FOUND`).
  - If the target is an `owner` and `countOwners() <= 1` → `conflict('Cannot remove the last owner')`.
  - Delete the `workspace_members` row. (Content created by the member is untouched.)

- **`leave(db, userId, { workspaceId })`** → `Result<void, AppError>`
  - The caller is already verified as a member by `workspaceProcedure`.
  - Load the caller's membership (else `NOT_FOUND`).
  - If the caller is an `owner` and `countOwners() <= 1` → `conflict('Make someone else an owner before leaving')`.
  - Delete the caller's `workspace_members` row.

Notes: `removeMember` targeting yourself is allowed but is functionally `leave`; the UI uses
`leave` for self and `removeMember` for others. No activity logging (consistent with the rest of
`WorkspaceService`, which doesn't log).

### 2. Validation + router

Add to `apps/api/src/utils/validation.ts`:
```ts
export const changeRoleSchema = z.object({
  workspaceId: uuidSchema,
  targetUserId: uuidSchema,
  role: z.enum(['owner', 'member']),
});
export const removeMemberSchema = z.object({ workspaceId: uuidSchema, targetUserId: uuidSchema });
export const leaveSchema = z.object({ workspaceId: uuidSchema });
```

Router (`apps/api/src/routers/workspace.ts`) — all `workspaceProcedure` (each input carries
`workspaceId`, so the caller is verified as a member; owner-only checks live in the service):
```ts
  changeRole: workspaceProcedure.input(changeRoleSchema).mutation(...WorkspaceService.changeRole),
  removeMember: workspaceProcedure.input(removeMemberSchema).mutation(...WorkspaceService.removeMember),
  leave: workspaceProcedure.input(leaveSchema).mutation(...WorkspaceService.leave),
```

### 3. Web — `WorkspaceSettings` member management

`WorkspaceSettings` already receives `members`, `currentUserId`, and `role`. Make the member list
interactive:

- **Owner view:** for each member *other than the current user*, a small control set:
  - **Make owner** (if member) / **Make member** (if owner) → `changeRole`.
  - **Remove** → `removeMember`.
  - The last owner's row hides demote + remove (UI mirrors the server guard:
    compute `ownerCount = members.filter(m => m.role === 'owner').length`; when `ownerCount <= 1`,
    that owner's demote/remove are suppressed).
  - The current owner also sees **Leave workspace** for themselves, enabled only when
    `ownerCount > 1`.
- **Member view (`role === 'member'`):** read-only list + a **Leave workspace** button for self.
- All mutations invalidate `workspace.members` and `workspace.mine`. On a successful **leave**
  (self-removal), route to `/dashboard` (the provider/switcher drop the workspace and fall back).
- Toasts on success/error; controls disabled while pending.

A small presentational unit (e.g. a `MemberRow` within `WorkspaceSettings`, or inline) keeps the
row logic readable; keep it in the existing `WorkspaceSettings.tsx` unless it grows large.

### 4. Testing

- **API** (`workspace.test.ts`): `changeRole` — owner promotes a member (role becomes owner);
  a member calling it → `FORBIDDEN`; demoting the only owner → `CONFLICT`; promoting then demoting
  works once a second owner exists. `removeMember` — owner removes a member (gone from `members`);
  member caller → `FORBIDDEN`; removing the last owner → `CONFLICT`. `leave` — a member leaves
  (no longer in `mine`/`members`); a non-last owner leaves; the last owner → `CONFLICT`.
- **Web** (`WorkspaceSettings.test.tsx`): owner sees Make owner/member + Remove + a guarded Leave;
  member sees only Leave; when there's a single owner, that owner's demote/remove are hidden;
  clicking the controls calls the right mutations (mocked tRPC).

## Non-goals (this slice)

- No distinct "transfer ownership" action (promote-then-demote covers it).
- No content reassignment on removal (content stays).
- No visibility/sharing changes — **slice C**.
- No email/notification on role change or removal. No mobile. No new migration.

## Affected files (indicative)

- **API:** `apps/api/src/services/workspace.service.ts` (`countOwners`, `changeRole`,
  `removeMember`, `leave`), `apps/api/src/utils/validation.ts`, `apps/api/src/routers/workspace.ts`,
  `apps/api/src/routers/workspace.test.ts`.
- **Web:** `apps/web/src/components/settings/WorkspaceSettings.tsx` (+ `.module.css`, + test).
