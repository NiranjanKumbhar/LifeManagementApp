# App-Shell Consistency — Design Spec

> **Date:** 2026-06-14
> **Scope:** A shared `PageShell` + `PageHeader` layout primitive applied across
> every web screen (collapsing ~9 divergent page-shell variants into one and
> fixing a token bug), plus a mobile bottom-nav **"More" menu** so Calendar,
> People, and Settings are reachable on a phone. UX/consistency work — no new
> screens or backend.
> **Status:** Approved for planning.

## 1. Goal & Context

A design audit of the nine `(app)` screens found the aesthetic direction is fine
but the **page chrome has drifted** — each screen re-implements its own
container/header CSS, inconsistently:

- **Max-width** differs five ways: projects `960px`, projects-detail `720px`,
  inbox `760px`, calendar/household/people `56rem` (896px),
  settings/person-detail `48rem` (768px).
- **Page-title size** has no standard: dashboard/inbox `--ls-text-4xl`, projects
  `--ls-text-3xl`, project-detail `--ls-text-2xl`, household/people/settings
  hardcode `1.6rem`, calendar `1.4rem`.
- **Bug:** `household.module.css` uses `var(--font-display, 'Fraunces', serif)` —
  `--font-display` is **undefined**, so it falls back to the literal font instead
  of the themed `--ls-font-display`.
- Each screen re-declares `.page` / `.heading` / `.head` / `.center`.

Separately, the **mobile bottom nav** only has Home / Inbox / Projects / Household
— so **Calendar, People, and Settings are unreachable on mobile** (the desktop
sidebar lists all seven). This was the foreseen "add a More overflow once those
screens exist" gap.

These two are one UX category (app-shell consistency). **No backend, shared-types,
DB, or new-route changes** — purely presentational components + nav + CSS cleanup.

## 2. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Page width model | **Single uniform width** (~56rem / 900px) for every screen via `PageShell` (no width variants) |
| Page-title size | **Standardize to `--ls-text-3xl`** in `--ls-font-display` |
| Mobile bar split | **Home · Inbox · (FAB) · Projects · Household · More**; **More → Calendar · People · Settings** in a bottom sheet |
| More presentation | **Bottom sheet** (slides up; backdrop; Esc/tap-to-close) |

### Out of scope (deferred)
- Dark / system mode (separate slice — the next item in this UX theme).
- Workspace rename + invite-by-code (separate backend-bearing slices).
- Any visual redesign beyond unifying width/heading/spacing (the warm-paper
  aesthetic stays).
- Native mobile (`apps/mobile`) — web only.

## 3. Shared layout components (`@lifesync/ui`)

### 3.1 `PageShell`
- The centered, max-width, padded page column. Canonical tokens (replace the five
  current widths): **max-width `56rem`**, padding `1.5rem`, vertical gap `1.25rem`,
  centered (`margin: 0 auto`), `width: 100%`.
- Props: `{ children }`. Renders a single wrapper element with the page class.
- Co-located `*.module.css`, `*.test.tsx`, barrel export.

### 3.2 `PageHeader`
- A consistent page header. Props:
  - `title: ReactNode` — rendered as the page **`<h1>`** in `--ls-font-display` at
    `--ls-text-3xl`. Accepting a `ReactNode` lets Calendar pass its month-nav
    control as the title.
  - `subtitle?: string` — muted secondary line.
  - `backHref?: string` — when set, renders a `← back` `Link` above the title (for
    detail pages).
  - `actions?: ReactNode` — right-aligned slot for buttons (New project, Edit, etc.).
- Layout: optional back link; a row with title/subtitle on the left and `actions`
  on the right; wraps on narrow widths.

## 4. Screen migration

Every `(app)` screen switches to `<PageShell><PageHeader …/> … </PageShell>` and
**deletes its bespoke `.page` / `.heading` / `.head` / `.center` rules**.
Screen-specific body CSS (grids, lists, cards, sections) stays.

| Screen | Header via `PageHeader` |
|---|---|
| `/dashboard` | greeting as `title`; 7-block body untouched |
| `/inbox` | title (+ subtitle) |
| `/projects` | title + `actions` (status filter, New project) |
| `/projects/[id]` | `backHref="/projects"`, title, `actions` (Edit/Archive/Complete) |
| `/household` | title (+ subtitle); tab control stays in body |
| `/people` | title (+ subtitle) + `actions` (New person) |
| `/people/[id]` | `backHref="/people"`, title, `actions` (Edit/Delete) |
| `/calendar` | `title` = month-nav node; `actions` = Today |
| `/settings` | title |

**Allowed exception:** if fitting Calendar's prev/title/next + Today into
`PageHeader` proves awkward, Calendar keeps a custom header **inside** `PageShell`
(still gets the uniform column). Decide during implementation; prefer `PageHeader`.

Each migration is **its own commit**, running the full web suite after each so any
regression is isolated.

## 5. Mobile "More" menu

- **`apps/web/src/components/app-shell/nav-items.tsx`** — keep
  `bottomNavItems = [Home, Inbox, Projects, Household]`; add
  `moreNavItems = [Calendar, People, Settings]`. Desktop `navItems` unchanged.
- **`BottomNav.tsx`** — render `Home, Inbox` · **FAB** · `Projects, Household` ·
  **More** (a `<button>`, not a link). The **More tab is "active"** when the
  current `pathname` matches any `moreNavItems.href` (so the user sees they're in a
  More section). Tapping it opens the sheet.
- **`MoreSheet`** (new, app-shell) — a **bottom sheet**: a bottom-anchored panel
  over a `surface.overlay` backdrop, listing Calendar / People / Settings as large
  icon-led `Link` rows (≥44px). Closes on row tap, backdrop click, and Escape;
  restores focus to the More button; respects `prefers-reduced-motion`. Reuses the
  QuickCapture overlay/Escape pattern, anchored to the bottom.
- Mobile-only (the bottom nav is already hidden on desktop). No new routes.

## 6. Testing

- **UI package (Vitest + RTL):**
  - `PageShell` renders its children inside the wrapper.
  - `PageHeader` renders `title` as an `<h1>`; renders the `actions` slot, the
    `backHref` link, and `subtitle` when provided.
- **Web:**
  - `BottomNav` — the four primary tabs + a **More** button render; clicking More
    opens the sheet with Calendar / People / Settings links (correct `href`s);
    selecting a row closes it; the More tab shows active on those routes.
  - `MoreSheet` — opens, and closes on backdrop + Escape.
  - **Regression:** every migrated screen's existing `page.test.tsx` passes
    **unchanged** — `PageHeader` keeps the `<h1>` + title text, so
    `getByRole('heading', { name })` still resolves. Run the full web suite after
    each screen migration.
- No API/E2E tests (no backend change).

## 7. Risks

- **Wide diff** (all 9 screens). Mitigation: one commit per screen; full web suite
  green after each.
- **Heading size change** — dashboard/inbox drop `text-4xl → text-3xl`; intentional
  uniformity, not a regression. Any page test asserting heading *text* (not size)
  is unaffected.
- **Calendar header** — the one place the header shape genuinely differs; handled
  via the §4 exception.

## 8. File-level change summary

**New (UI):** `packages/ui/src/components/PageShell/*`,
`packages/ui/src/components/PageHeader/*` (+ barrel exports).

**New (web):** `apps/web/src/components/app-shell/MoreSheet.tsx` (+ module css; test).

**Changed (web):**
- All `(app)` `page.tsx` files — adopt `PageShell`/`PageHeader`; trim their
  `*.module.css` (remove the page-shell rules).
- `apps/web/src/components/app-shell/nav-items.tsx` — add `moreNavItems`.
- `apps/web/src/components/app-shell/BottomNav.tsx` — add the More button + sheet
  wiring (+ its test).

**Changed:** none in API / shared-types / DB. No new routes.
