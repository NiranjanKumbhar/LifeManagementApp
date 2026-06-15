# Mobile UX fixes + Theme switching — Design

**Date:** 2026-06-15
**Status:** Approved (design)
**Scope:** Web app (`apps/web`) + design tokens (`apps/web/src/styles/variables.css`). No API, mobile-app, or sync changes.

## Problem

Issues observed using the deployed web app on a phone:

1. **Cramped bottom nav** — six-column grid `[Home][Inbox][+][Projects][Household][More]` packs five labels plus a FAB into a phone width.
2. **Off-center "+"** — in a 6-cell grid the capture FAB lands in cell 3 of 6, visibly left of center.
3. **Inbox looks broken on mobile** — appears to "lose the nav bar" and misalign. Root cause is horizontal overflow (see §3), not a navigation/reload problem.
4. **No theme control** — there is no dark/system/light option; the app is light-only.

## Decisions (from brainstorming)

- Nav: **5-cell bar, centered FAB, 4 tabs**. Household moves into the "More" sheet.
- Theme: **System + Light + Dark**, default System, **stored local-device only** (`localStorage`).

## Design

### 1. Bottom nav redesign

Files: `apps/web/src/components/app-shell/nav-items.tsx`, `BottomNav.tsx`, `BottomNav.module.css`, `BottomNav.test.tsx`.

- `bottomNavItems` → `[Home (/dashboard), Inbox (/inbox), Projects (/projects)]`.
- `moreNavItems` → `[Household (/household), Calendar (/calendar), People (/people), Settings (/settings)]`.
- `BottomNav` renders, left→right: `Home`, `Inbox`, **FAB**, `Projects`, **More** button → 5 cells.
- CSS: `.bar` grid `grid-template-columns: repeat(5, 1fr)`; FAB stays `justify-self: center` so it occupies the exact middle (cell 3 of 5).
- No change to the FAB action (`onQuickCapture`) or the `MoreSheet` mechanism. `MoreSheet` already renders `moreNavItems`, so adding Household flows through automatically.
- Test updates: assert 4 tab links (Home/Inbox/Projects/More-trigger), FAB present and centered, and that Household appears in the More sheet rather than the bar.

### 2. Inbox overflow fix

Files: `apps/web/src/components/inbox/InboxItemRow.module.css` (and `.tsx` only if needed).

- Cause: `.actions { flex-shrink: 0 }` plus a `<select>` with no width cap. Long project titles widen the select, pushing the row past the viewport and causing page-level horizontal scroll, which makes the fixed bottom bar look displaced.
- Fix: allow the select to shrink — `min-width: 0` and a sensible `max-width` (e.g. `100%` within the stacked mobile layout; cap on wider rows). Ensure `.actions` can shrink within the row. Confirm the row never exceeds `100%` width at mobile widths.
- Pure CSS; no behavior change. Manually verify at ≤390px width with a long project name present.

### 3. Theme switching (System / Light / Dark)

**Tokens** — `apps/web/src/styles/variables.css`:
- Keep current `:root` as the light theme.
- Add a `[data-theme="dark"]` block overriding the *semantic* tokens: `--ls-surface-*`, `--ls-text-*`, `--ls-surface-border*`, `--ls-surface-overlay`, shadows (softened/darkened), and the `*-soft` urgency tints. Brand `--ls-primary-*` stays the same scale (may nudge which step is used by surfaces if needed). Spacing/radii/typography/motion tokens are unchanged.

**Provider** — new `apps/web/src/lib/theme.tsx`:
- `ThemeProvider` + `useTheme()` hook exposing `{ mode, setMode }` where `mode ∈ 'system' | 'light' | 'dark'`.
- Persists `mode` to `localStorage` under key `ls-theme`.
- Resolves effective theme: `dark`/`light` direct; `system` via `window.matchMedia('(prefers-color-scheme: dark)')`, subscribing to changes while in system mode.
- Applies the result by setting `document.documentElement.dataset.theme = 'light' | 'dark'`.
- Mounted inside `Providers` (`apps/web/src/lib/providers.tsx`).

**No-flash script** — `apps/web/src/app/layout.tsx`:
- Add a small synchronous inline `<script>` in `<head>` that reads `localStorage['ls-theme']`, resolves `system` via `matchMedia`, and sets `data-theme` on `<html>` before first paint. Prevents a light-mode flash on initial load for dark users.

**Settings UI** — `apps/web/src/app/(app)/settings/page.tsx` (+ a small component if it keeps the page tidy):
- New "Appearance" `SectionCard` containing the existing `SegmentedControl` with options System / Light / Dark, wired to `useTheme()`.

### 4. Testing & verification

- `pnpm test --filter=web` green, including the updated `BottomNav` test. Add a light test for `ThemeProvider` (mode persists to `localStorage`, sets `data-theme`).
- `pnpm --filter=web build` green.
- Manual mobile-width pass (≤390px): nav centered & roomy, Inbox no horizontal scroll, theme toggle switches instantly with no reload and survives refresh.

## Out of scope (YAGNI)

- Account-synced theme preference (local-only for now; can sync via user prefs later).
- Desktop sidebar changes and any change to the quick-capture flow itself.
- Dark-mode fine-tuning of imagery/illustrations beyond token overrides.
