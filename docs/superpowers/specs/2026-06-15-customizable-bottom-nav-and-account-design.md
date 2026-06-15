# Customizable Bottom-Nav Button + Account Display — Design

> **Date:** 2026-06-15
> **Status:** Approved (design), pending implementation plan
> **Scope:** `apps/web` only (the web app's mobile/responsive shell). The React Native `apps/mobile` app is untouched (still scaffolding).

## Problem

Two related navigation/UX gaps in the web app shell:

1. **The mobile bottom bar's second button is hard-coded to Inbox.** Some users want a
   different secondary screen there. There is no way to change it.
2. **The account control is desktop-only and mislabeled.** The Clerk `<UserButton />` lives
   only in the desktop sidebar footer, paired with the literal text "Your account". It is not
   reachable on mobile at all, and it should show the user's name rather than "Your account".

## Decisions (from brainstorming)

- The customizable slot offers the **five secondary screens**: Inbox, Household, Calendar,
  People, Settings. Home, Projects, the capture FAB, and More stay fixed.
- The preference is stored **per-device in `localStorage`**, mirroring the existing theme
  preference. No backend/DB changes.
- "Mobile" means the web app on small screens (bottom nav + More sheet), not the RN app.

## Current state (for reference)

- `apps/web/src/components/app-shell/nav-items.tsx` defines `navItems` (sidebar),
  `bottomNavItems` (`[Home, Inbox, Projects]`), and `moreNavItems` (`[Household, Calendar, People, Settings]`).
- `BottomNav.tsx` renders `bottomNavItems.slice(0,2)` (Home, Inbox), then the FAB, then
  `bottomNavItems.slice(2)` (Projects), then a "More" button opening `MoreSheet`.
- `MoreSheet.tsx` lists `moreNavItems`.
- `NavigationSidebar.tsx` footer renders `<UserButton />` + `<span>Your account</span>`.
- `apps/web/src/lib/theme.tsx` is the precedent: a `localStorage`-backed context
  (`ThemeProvider`/`useTheme`) mounted in `providers.tsx`, toggled from a Settings `SectionCard`.
- `trpc.user.me` returns `{ id, displayName, email, timezone, ... }` — the name source.
- The user's name is the canonical `me.displayName` (used by `ProfileSettings`).

## Design

### 1. Nav preference store — `apps/web/src/lib/nav-prefs.tsx` (new)

Mirror `theme.tsx`:

```ts
export type SecondNavKey = 'inbox' | 'household' | 'calendar' | 'people' | 'settings';
```

- `NavPrefsProvider` + `useSecondNav()` returning `{ secondNav, setSecondNav }`.
- `localStorage` key `ls-second-nav`. Lazy initializer reads the stored value on first client
  render; default `'inbox'`; invalid/unset → `'inbox'`.
- `setSecondNav` writes `localStorage` then updates state (context), so the bottom bar updates live.
- Mounted in `apps/web/src/lib/providers.tsx` alongside `ThemeProvider`.

No no-flash inline script is needed (unlike theme) — the bottom bar is not above-the-fold
server-rendered content in a way that flashes; it hydrates client-side. Default `inbox` matches
today's behavior, so first paint is unchanged.

### 2. nav-items refactor — `nav-items.tsx`

- Keep `navItems` (full sidebar set) unchanged.
- Add a typed registry of the five secondary screens:

```ts
export const SECONDARY_NAV: Record<SecondNavKey, NavItem> = {
  inbox: { label: 'Inbox', href: '/inbox', icon: <InboxIcon /> },
  household: { label: 'Household', href: '/household', icon: <HouseholdIcon /> },
  calendar: { label: 'Calendar', href: '/calendar', icon: <CalendarIcon /> },
  people: { label: 'People', href: '/people', icon: <PeopleIcon /> },
  settings: { label: 'Settings', href: '/settings', icon: <SettingsIcon /> },
};

export const SECOND_NAV_ORDER: SecondNavKey[] = ['inbox', 'household', 'calendar', 'people', 'settings'];

export const HOME_NAV_ITEM: NavItem = { label: 'Home', href: '/dashboard', icon: <HomeIcon /> };
export const PROJECTS_NAV_ITEM: NavItem = { label: 'Projects', href: '/projects', icon: <ProjectsIcon /> };
```

- Remove the now-derived `bottomNavItems` and `moreNavItems` constants; the bar and sheet
  compute their contents from `SECONDARY_NAV` + the selected key (see §3, §4). Update any other
  importers accordingly (search the repo for `bottomNavItems`/`moreNavItems`).

### 3. BottomNav — `BottomNav.tsx`

- Read `const { secondNav } = useSecondNav();`.
- Layout: `HOME_NAV_ITEM` → `SECONDARY_NAV[secondNav]` → FAB → `PROJECTS_NAV_ITEM` → More button.
- "More" active state: derived from the four non-selected secondary screens (the set the sheet
  shows), so the More tab highlights when on one of those routes.

### 4. MoreSheet — `MoreSheet.tsx`

- Read `const { secondNav } = useSecondNav();`.
- Items = `SECOND_NAV_ORDER.filter((k) => k !== secondNav).map((k) => SECONDARY_NAV[k])` — the four
  secondary screens not promoted to the second button (no duplication).
- Add an **account footer**: render `<AccountControl />` (§6) at the bottom of the sheet, visually
  separated. This is how the account becomes reachable on mobile.

### 5. Settings card — `apps/web/src/components/settings/NavSettings.tsx` (new)

- A `SectionCard` titled **"Bottom bar"**.
- `Input as="select"` bound to `useSecondNav()`:
  `options = SECOND_NAV_ORDER.map((k) => ({ value: k, label: SECONDARY_NAV[k].label }))`.
  Label "Second button"; `helperText` "Shown in the bottom navigation on smaller screens."
- Added to `apps/web/src/app/(app)/settings/page.tsx` after `AppearanceSettings`.

### 6. AccountControl — `apps/web/src/components/app-shell/AccountControl.tsx` (new)

- Renders the Clerk `<UserButton />` + the user's name.
- Name via `trpc.user.me.useQuery()` → `data?.displayName`; while loading or on error, fall back
  to the text **"Your account"** (so it never renders blank).
- Used in:
  - `NavigationSidebar.tsx` footer — replaces the inline `<UserButton /> + "Your account"`.
  - `MoreSheet.tsx` footer (new).
- The component is presentational + one query; it owns no other state.

## Testing

- `nav-prefs.test`: default is `inbox`; `setSecondNav` persists to `localStorage` and updates the
  value; a stored value is read back; an invalid stored value falls back to `inbox`.
- `BottomNav.test` (update existing): the second button reflects the selected key (e.g. set
  `calendar` → a "Calendar" link renders in the bar; Inbox does not).
- `MoreSheet.test` (update existing): with `secondNav = 'inbox'`, the sheet shows Household/
  Calendar/People/Settings and NOT Inbox; the account footer renders.
- `NavSettings.test`: changing the select calls `setSecondNav` with the chosen key.
- `AccountControl.test`: shows `displayName` from `user.me`; falls back to "Your account" when the
  query has no data.

## Non-goals (YAGNI)

- Only the second slot is configurable. No reordering of Home/Projects/More, no multi-slot config.
- No backend/DB/migration changes (per-device localStorage only).
- No changes to the React Native `apps/mobile` app.
- No new no-flash script (default matches current behavior).

## Affected files

- Create: `apps/web/src/lib/nav-prefs.tsx`, `apps/web/src/components/settings/NavSettings.tsx`,
  `apps/web/src/components/app-shell/AccountControl.tsx` (+ co-located tests/CSS as needed).
- Modify: `apps/web/src/components/app-shell/nav-items.tsx`, `BottomNav.tsx`, `MoreSheet.tsx`,
  `NavigationSidebar.tsx`, `apps/web/src/lib/providers.tsx`,
  `apps/web/src/app/(app)/settings/page.tsx`, and existing `BottomNav.test.tsx` / `MoreSheet.test.tsx`.
