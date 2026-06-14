# Slice E — Settings (Web) — Design Spec

> **Date:** 2026-06-14
> **Scope:** The `/settings` screen — Profile, Notification preferences, and
> Workspace sections, auto-saving over the existing `user`/`workspace` routers.
> Fifth and final sub-project of the "Web screens beyond Dashboard + Inbox"
> roadmap item (A=Projects ✅, B=Household ✅, C=People ✅, D=Calendar ✅).
> **Status:** Approved for planning.

## 1. Goal & Context

The sidebar links to `/settings`, but the route 404s. This slice delivers the
app-level preferences screen. **Clerk already owns identity** — its `UserButton`
(in the sidebar) handles avatar, email, password, and sign-out — so Settings
focuses on the preferences Clerk does not manage.

The backend is ready: `user` router exposes `me`, `updateProfile`
(`displayName`/`avatarUrl`/`timezone`, field-level merge), and
`updateNotificationPrefs` (which **replaces** the whole `notificationPreferences`
object). `workspace` exposes `get`, `members`, and a stubbed `invite`
(`NOT_IMPLEMENTED`). **No backend, shared-types, or DB changes** — pure frontend.

`NotificationPreferences` = `{ quietHours?: { start; end }, digestMode?: 'none' |
'daily' | 'weekly', channels?: { push; email; inApp } }`. Notification **delivery
is not built** (no Inngest jobs) — these preferences are stored for when it is.

## 2. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Sections (v1) | **Profile + Notifications + Workspace** |
| Layout | **Single scrollable page** with three section cards |
| Save model | **Auto-save** — toggles/selects on change, text on blur; per-section status indicator; Toast + revert on error |

### Out of scope (deferred)
- Avatar / email / password / sign-out — handled by Clerk's `UserButton`.
- Workspace **rename** (no `workspace.update` endpoint) and **invites** (the
  `invite` procedure is stubbed pending Clerk Organizations).
- Notification **delivery** (Inngest jobs) — this slice only stores preferences.
- Theme / appearance toggles, data export, account deletion.
- Native mobile code — web only; parity noted in §7.

## 3. Page & sections

Route `apps/web/src/app/(app)/settings/page.tsx` (client) + `loading.tsx`,
`settings.module.css`, `page.test.tsx`. A single scrollable page with three
`SectionCard`s.

### 3.1 Profile
- `displayName` — text `Input`, saves **on blur** via `updateProfile({ displayName })`.
- `timezone` — `Input as="select"`, saves **on change** via
  `updateProfile({ timezone })`. Options from `Intl.supportedValuesOf('timeZone')`
  with a guarded fallback to a small curated list if unavailable.
- `email` — **read-only** display (from `user.me`; Clerk owns it).

### 3.2 Notifications
- **Channels** — three checkboxes: push / email / in-app.
- **Quiet hours** — start/end `time` inputs.
- **Digest** — select: none / daily / weekly.
- Because `updateNotificationPrefs` **replaces** the object, the section holds the
  full prefs in local state and sends the **complete** `{ quietHours, digestMode,
  channels }` on every change via `updateNotificationPrefs({ preferences })`.
- An honest inline note: *"Notifications aren't delivered yet — these preferences
  are saved for when delivery is enabled."* (No "you'll be notified" copy.)

### 3.3 Workspace
- **Name** — read-only (from `workspace.get`).
- **Members** — `workspace.members({ workspaceId })`, each row an `Avatar` + name +
  role badge (owner/member via `Badge`/`PartnerBadge`).
- **Invite** — a `Button` rendered **disabled** with a "Coming soon" hint. The
  `invite` procedure is never called.

## 4. Auto-save mechanics

- Each editable section owns local form state seeded from its query data.
- A control change (toggle/select) or text **blur** fires the section's mutation.
- A small `useSaveStatus` hook drives a per-section indicator:
  `idle → saving → saved` (the `saved` state fades after ~2s).
- `onSuccess`: invalidate `user.me`, set `saved`.
- `onError`: show an error Toast and invalidate `user.me` so the control **reverts**
  to the persisted value.
- The Workspace section is read-only — no mutations.

## 5. Components

**New web-local (`apps/web/src/components/settings/`):**
- `SectionCard.tsx` — title + a status-indicator slot + body; consistent wrapper for
  the three sections.
- `ProfileSettings.tsx` — name + timezone + read-only email; owns `updateProfile`.
- `NotificationSettings.tsx` — channels + quiet hours + digest; owns
  `updateNotificationPrefs`; renders the delivery note.
- `WorkspaceSettings.tsx` — read-only name + members list + disabled Invite.

**New web util/hook (`apps/web/src/lib/settings/`):**
- `useSaveStatus.ts` — returns `{ status, markSaving, markSaved, markError }`
  driving the `Saving…`/`Saved ✓` indicator. Small; unit-tested.
- `timezones.ts` — `listTimeZones()` returning `Intl.supportedValuesOf('timeZone')`
  or a curated fallback. Pure.

**Reused from `@lifesync/ui`:** `Input`, `Button`, `Avatar`, `Badge`,
`PartnerBadge`, `EmptyState`, `LoadingSpinner`, `useToast`.

## 6. Data flow & states

- tRPC + React Query: `user.me` (profile + prefs), `workspace.get` +
  `workspace.members({ workspaceId })` via `useWorkspaceId`.
- Mutations: `updateProfile`, `updateNotificationPrefs` — invalidate `user.me` on
  success/error as in §4.
- **States** (explicit): loading → `LoadingSpinner` (+ `loading.tsx`); `user.me`
  error → `EmptyState`; members loading/empty handled inline.
- `Date` fields are not edited here; no tz math beyond the timezone *string*.

## 7. Testing & mobile

**Testing (Vitest + RTL):**
1. Editing the name and blurring calls `updateProfile` with `{ displayName }`.
2. Changing the timezone select calls `updateProfile` with `{ timezone }`.
3. Toggling a notification channel calls `updateNotificationPrefs` with the **full**
   `preferences` object (channels + quietHours + digestMode).
4. The Workspace section renders members and the Invite button is **disabled**.
5. `useSaveStatus` unit test: `idle → saving → saved` transitions.
- No API tests (no backend change). No Playwright (consistent with the repo).

**Mobile:** section cards stack full-width; controls are touch-sized; selects are
native (mobile-friendly). Parity noted for the eventual native settings; web only.

## 8. File-level change summary

**New (web):**
- `apps/web/src/app/(app)/settings/{page.tsx,loading.tsx,settings.module.css,page.test.tsx}`.
- `apps/web/src/components/settings/{SectionCard,ProfileSettings,NotificationSettings,WorkspaceSettings}.tsx`
  (+ module css).
- `apps/web/src/lib/settings/{useSaveStatus.ts,useSaveStatus.test.ts,timezones.ts}`.

**Changed:** none in API / shared-types / DB. The `/settings` sidebar link already
exists. (This slice removes the only remaining dead sidebar route.)
