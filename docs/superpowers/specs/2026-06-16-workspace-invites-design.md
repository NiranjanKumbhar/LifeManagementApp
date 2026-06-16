# Workspace Membership — Slice A: Invites & Joining — Design

> **Date:** 2026-06-16
> **Status:** Approved (design), pending implementation plan
> **Epic:** Workspace membership & sharing, sequenced as **A (this) → B (roles & member management) → C (visibility & encapsulation)**.
> **Scope:** `apps/api` + `apps/web` + shared packages. No `apps/mobile` changes. No Clerk Organizations.

## Context / current state

- `workspace_members` exists: `{ workspaceId, userId, role: 'owner'|'member', invitedAt, joinedAt }`, unique on `(workspaceId, userId)`. Members already seeded (Alex=owner, Jordan=member).
- `WorkspaceService` has `get` / `create` (enrolls creator as `owner`) / `members`. **No** invite/accept/revoke/list/mine.
- `workspace.invite` router procedure throws `NOT_IMPLEMENTED`. A `WorkspaceInvite` *type* + `InviteStatus` enum exist in shared-types but are unused, and there is **no `workspace_invites` table**.
- New users are provisioned via Clerk (JIT in `user-provisioning.service.ts` + a `user.created`/`user.updated` Svix webhook). Today `ensureDefaultMembership` auto-joins everyone to `DEFAULT_WORKSPACE_ID` ("Our Home").
- The web active workspace is hardcoded: `useWorkspaceId()` returns `process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID`. There is no `workspace.list`/current-workspace endpoint.

## Decisions (from brainstorming)

- **Workspace size:** small household, **max 6 members** (epic-wide).
- **Invite mechanism:** in-app **invite link/code** (tokenized), optionally emailed via the existing Resend setup; **copy-link is the primary path**. Not Clerk Organizations.
- **New user without invite:** **create their own personal workspace** (owner); retire the everyone-joins-default auto-join (kept only as an explicit dev fallback).
- **Multiple workspaces per user:** supported, with a **workspace switcher**; active choice persisted per device.
- **Inviter:** owner-only for this slice (full role management is slice B).

## Design

### 1. Data model — migration `0004_workspace_invites.sql` + `schema/workspaces.ts`

New table `workspace_invites`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `workspace_id` | uuid NOT NULL → workspaces(id) ON DELETE CASCADE | |
| `token` | text NOT NULL UNIQUE | random URL-safe string; indexed for lookup |
| `email` | text NULL | informational / for the emailed copy; not an access gate |
| `role` | text NOT NULL DEFAULT 'member' CHECK in ('owner','member') | role granted on accept |
| `status` | text NOT NULL DEFAULT 'pending' CHECK in ('pending','accepted','revoked','expired') | |
| `invited_by` | uuid NOT NULL → users(id) | |
| `expires_at` | timestamptz NOT NULL | default now() + 7 days (set in app) |
| `accepted_by` | uuid NULL → users(id) | |
| `accepted_at` | timestamptz NULL | |
| `created_at` | timestamptz NOT NULL DEFAULT now() | |

Indexes: unique on `token`; index on `workspace_id`. Add the Drizzle table to `schema/workspaces.ts` and export `WorkspaceInvite` row types. Reconcile the existing shared-types `WorkspaceInvite` interface + `InviteStatus` to match these columns.

This is purely additive; no backfill.

### 2. API — `WorkspaceService` methods + `workspace` router

All invite procedures are workspace-scoped (`workspaceProcedure`) and authorize the actor.

- **`createInvite(db, userId, { workspaceId, email? })`** — actor must be `owner` (else `FORBIDDEN`). Enforce the 6-member cap is not already met (count members + pending invites would be checked at accept-time too). Generate `token` (crypto-random), `expiresAt = now + 7d`, insert `pending`. Return `{ invite, joinPath: '/join/<token>' }`. If `email` provided, send the link via Resend (best-effort; failure to email does not fail the mutation). Log activity.
- **`acceptInvite(db, userId, { token })`** — look up by token. Reject if not `pending`, expired (`expires_at < now` → also flip status to `expired`), or revoked → `NOT_FOUND`/`error`. If the user is already a member → return that workspace (idempotent, mark invite accepted). Enforce **member count < 6** (else `CONFLICT` "Workspace is full"). Insert `workspace_members` (role from invite, `joinedAt = now`), set invite `status='accepted'`, `accepted_by`, `accepted_at`. Return the workspace. Log activity.
- **`revokeInvite(db, userId, { id })`** — owner-only; set `status='revoked'`. 
- **`listInvites(db, userId, { workspaceId })`** — owner-only; return pending (non-expired) invites for management.
- **`mine(db, userId)`** — return `Array<{ workspace, role }>` for the current user (joins `workspace_members` → `workspaces`). Drives the switcher and replaces the env hardcode.

Router: replace the stub `invite` with `createInvite`; add `acceptInvite`, `revokeInvite`, `listInvites`, `mine`. Add Zod schemas to `validation.ts` (`createInviteSchema`, `acceptInviteSchema`, `inviteIdSchema`; `mine` needs no input). `mine`/`acceptInvite` use `protectedProcedure` (not workspace-scoped — the user may not be a member yet / is choosing among workspaces); `createInvite`/`revokeInvite`/`listInvites` use `workspaceProcedure`.

### 3. New-user provisioning — `ensureOwnWorkspace`

Replace `ensureDefaultMembership` in `user-provisioning.service.ts`:

```
ensureOwnWorkspace(db, user):
  if user already has any workspace_members row → return (no-op)
  if DEFAULT_WORKSPACE_ID is set AND that workspace exists AND process is dev → join it as member (legacy dev fallback)
  else → create a workspace named "<firstName>'s Home" (fallback "My Home") and enroll the user as owner
```

Called from both `provisionFromClerkId` and `upsertFromWebhook` (where `ensureDefaultMembership` is called today). Guarantees `mine()` returns ≥1 workspace for every user.

### 4. Web — active workspace, switcher, join page, invite UI

- **`WorkspaceProvider` + `useWorkspaceId` rewrite** (`apps/web/src/lib/`): a client context that calls `trpc.workspace.mine`, resolves the active workspace id from `localStorage` key `ls-active-workspace` (default = first membership, preferring an owned one), and exposes `{ workspaceId, workspaces, setActiveWorkspace }`. `useWorkspaceId()` keeps its existing signature (`() => string | null`) for current callers, now sourced from the provider. Remove the `NEXT_PUBLIC_DEFAULT_WORKSPACE_ID` dependency. Mount the provider in `providers.tsx` (inside the tRPC provider, since it queries).
- **Workspace switcher** — a small control in the sidebar header (and/or Settings): lists `workspaces`, shows the active one, switching calls `setActiveWorkspace` (persists + triggers refetch via query invalidation). When the user has only one workspace, render its name (no menu).
- **`/join/[token]` route** (`apps/web/src/app/join/[token]/page.tsx`) — outside the `(app)` shell or a minimal shell. Signed-in: fetch a light invite preview (workspace name) and show a "Join <workspace>" button → `acceptInvite` → `setActiveWorkspace(joined)` → redirect to `/dashboard`. Signed-out: Clerk redirects to sign-in and back to the same URL. Handle expired/revoked/full with a clear message.
- **Settings → Workspace** (`WorkspaceSettings.tsx`) — enable invites for owners: an "Invite" button calls `createInvite` and copies the join link to the clipboard (with a toast); a list of pending invites (from `listInvites`) each with **Revoke**. Keep the existing members list. Non-owners see the members list without invite controls.

The join page needs a light invite preview (workspace name) before the user commits to joining, without requiring membership. **Decision:** add `workspace.invitePreview({ token })` (protectedProcedure) returning `{ workspaceName, status }` — cleaner than overloading `acceptInvite`. It does not mutate; `acceptInvite` remains the only write.

### 5. Testing

- **API:** `createInvite` (owner-only; non-owner → FORBIDDEN; returns token/link); `acceptInvite` (joins with correct role; idempotent for existing member; rejects expired/revoked; `CONFLICT` when at 6 members); `revokeInvite` (owner-only; blocks later accept); `listInvites` (pending only, owner-only); `mine` (returns the user's workspaces + roles); `ensureOwnWorkspace` (new user with no membership gets an owned workspace; existing-member user is a no-op).
- **Web:** `WorkspaceProvider` picks/persists the active workspace and exposes the list; switcher renders and switches; `/join/[token]` accept happy-path + expired/full messaging (mocked tRPC); Settings invite create→copy + revoke (mocked tRPC + clipboard).

## Non-goals (this slice)

- Owner is the only inviter; changing roles, removing members, and member self-leave are **slice B**.
- No change to `shared`/`mine_visible`/`private` semantics — **slice C**.
- No Clerk Organizations; email delivery is optional (copy-link primary). No mobile.
- No re-invite throttling / rate limiting (general middleware is a separate roadmap item).

## Affected files (indicative)

- **DB:** `apps/api/src/db/migrations/0004_workspace_invites.sql` (new); `schema/workspaces.ts` (add `workspaceInvites`).
- **shared-types:** align `WorkspaceInvite` + `InviteStatus`; add invite input/output types; `mine` output type.
- **API:** `services/workspace.service.ts` (invite/accept/revoke/list/mine), `services/user-provisioning.service.ts` (`ensureOwnWorkspace`), `routers/workspace.ts`, `utils/validation.ts`, optional Resend helper; service/router tests.
- **Web:** `lib/workspace-context.tsx` (new) + `lib/hooks/useWorkspaceId.ts` (rewrite), `lib/providers.tsx`, a `WorkspaceSwitcher` component, `app/join/[token]/page.tsx` (new), `components/settings/WorkspaceSettings.tsx` (+ invite controls), tests.
