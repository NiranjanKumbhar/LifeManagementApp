# App-Shell Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce shared `PageShell` + `PageHeader` primitives, migrate every web screen to them (uniform width/heading, fixing the `--font-display` bug), and add a mobile bottom-nav "More" menu so Calendar/People/Settings are reachable.

**Architecture:** Two new `@lifesync/ui` components + a per-screen migration (each its own commit, suite green after each) + a `MoreSheet` bottom sheet wired into `BottomNav`. No backend / shared-types / DB / route changes.

**Tech Stack:** Next.js 15 client components, `@lifesync/ui`, Vitest + RTL + `@testing-library/user-event`, CSS Modules with `--ls-*` tokens.

**Spec:** `docs/superpowers/specs/2026-06-14-app-shell-consistency-design.md`

**Key reference facts (verified against the codebase):**
- `@lifesync/ui` barrel (`packages/ui/src/index.ts`) exports each component as `export { X } from './components/X/X'`. Components use `'use client'`, `cn` from `'../../utils/cn'`, co-located `*.module.css` + `*.test.tsx`.
- App tokens are `--ls-*` (`apps/web/src/styles/variables.css`): `--ls-font-display`, `--ls-text-3xl` (1.875rem), `--ls-text-sm/base`, `--ls-space-*`, `--ls-text-primary/secondary`.
- Current screens each declare `.page` (varying max-width) + `.head` + `.heading` (varying size) + `.subhead` + `.center`. `household.module.css` line ~20 wrongly uses `var(--font-display, 'Fraunces', serif)`.
- Page tests assert titles via `getByRole('heading', { name })` and body text — `PageHeader` renders the title as `<h1>`, so these keep passing.
- `BottomNav.tsx` renders `bottomNavItems.slice(0,2)` + FAB + `bottomNavItems.slice(2)`; the FAB calls `onQuickCapture`. `nav-items.tsx` exports `navItems` (sidebar, all 7) and `bottomNavItems` (4). Icons (`CalendarIcon`, `PeopleIcon`, `SettingsIcon`, etc.) live in `@/components/icons`. `usePathname` from `next/navigation`.
- QuickCapture overlay pattern (Escape + backdrop click + stopPropagation) is in `apps/web/src/components/app-shell/QuickCapture.tsx` — reuse for `MoreSheet`.

---

## File Structure

**New (UI):** `packages/ui/src/components/PageShell/{PageShell.tsx,.module.css,.test.tsx}`,
`packages/ui/src/components/PageHeader/{PageHeader.tsx,.module.css,.test.tsx}` (+ barrel exports).

**New (web):** `apps/web/src/components/app-shell/MoreSheet.tsx` (+ `.module.css`, `.test.tsx`).

**Changed (web):** all `(app)` `page.tsx` + their `*.module.css`; `nav-items.tsx`;
`BottomNav.tsx` (+ test).

**No changes** to API / shared-types / DB.

---

## Task 1: `PageShell` component

**Files:** `packages/ui/src/components/PageShell/{PageShell.tsx,PageShell.module.css,PageShell.test.tsx}`; modify `packages/ui/src/index.ts`.

- [ ] **Step 1: Write the failing test**

`PageShell.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageShell } from './PageShell';

describe('PageShell', () => {
  it('renders its children', () => {
    render(<PageShell><p>hello</p></PageShell>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → fail.** `pnpm --filter @lifesync/ui test -- PageShell` (cannot resolve).

- [ ] **Step 3: Write the component**

`PageShell.tsx`:
```tsx
import type { ReactNode } from 'react';
import styles from './PageShell.module.css';

export interface PageShellProps {
  children: ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return <div className={styles.shell}>{children}</div>;
}
```

`PageShell.module.css`:
```css
.shell {
  display: flex;
  flex-direction: column;
  gap: var(--ls-space-5);
  padding: var(--ls-space-6);
  max-width: 56rem;
  margin: 0 auto;
  width: 100%;
}
```

Add to `packages/ui/src/index.ts`:
```ts
export { PageShell, type PageShellProps } from './components/PageShell/PageShell';
```

- [ ] **Step 4: Run → pass.** `pnpm --filter @lifesync/ui test -- PageShell`

- [ ] **Step 5: Commit**
```bash
git add packages/ui/src/components/PageShell packages/ui/src/index.ts
git commit -m "feat(ui): add PageShell layout primitive"
```

---

## Task 2: `PageHeader` component

**Files:** `packages/ui/src/components/PageHeader/{PageHeader.tsx,PageHeader.module.css,PageHeader.test.tsx}`; modify `packages/ui/src/index.ts`.

`PageHeader` is platform-light but uses an `<a>` for `backHref` (it must not depend on `next/link`, which isn't available in the ui package) — callers on web still get client-side nav because the link sits inside the already-client page; a plain `<a href>` is acceptable for a back link.

- [ ] **Step 1: Write the failing test**

`PageHeader.test.tsx`:
```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the title as an h1', () => {
    render(<PageHeader title="Projects" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
  });

  it('renders subtitle, back link, and actions when provided', () => {
    render(
      <PageHeader
        title="Mum"
        subtitle="Mother"
        backHref="/people"
        actions={<button type="button">Edit</button>}
      />,
    );
    expect(screen.getByText('Mother')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /people/i })).toHaveAttribute('href', '/people');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Write the component**

`PageHeader.tsx`:
```tsx
import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  backHref?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, backHref, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      {backHref ? (
        <a href={backHref} className={styles.back}>
          ← Back
        </a>
      ) : null}
      <div className={styles.row}>
        <div className={styles.titles}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </header>
  );
}
```

`PageHeader.module.css`:
```css
.header {
  display: flex;
  flex-direction: column;
  gap: var(--ls-space-2);
}

.back {
  color: var(--ls-text-secondary);
  text-decoration: none;
  font-size: var(--ls-text-sm);
  width: fit-content;
}

.row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ls-space-4);
  flex-wrap: wrap;
}

.titles {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
}

.title {
  margin: 0;
  font-family: var(--ls-font-display);
  font-size: var(--ls-text-3xl);
  font-weight: 600;
  color: var(--ls-text-primary);
  letter-spacing: -0.02em;
}

.subtitle {
  margin: 0;
  font-size: var(--ls-text-base);
  color: var(--ls-text-secondary);
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--ls-space-2);
  flex-wrap: wrap;
}
```

Add to `packages/ui/src/index.ts`:
```ts
export { PageHeader, type PageHeaderProps } from './components/PageHeader/PageHeader';
```

- [ ] **Step 4: Run → pass.** `pnpm --filter @lifesync/ui test -- PageHeader`

- [ ] **Step 5: Commit**
```bash
git add packages/ui/src/components/PageHeader packages/ui/src/index.ts
git commit -m "feat(ui): add PageHeader (title, subtitle, backHref, actions)"
```

> **Build note for migrations:** after Tasks 1–2, run `pnpm --filter @lifesync/ui build` so `apps/web` resolves the new exports for typecheck.

---

## Migration recipe (Tasks 3–5)

For each screen:
1. Import `PageShell`/`PageHeader` from `@lifesync/ui` (drop now-unused imports).
2. Replace the outer `<div className={styles.page}>` with `<PageShell>`.
3. Replace the `<header className={styles.head}>…</header>` (title/subhead) with a
   `<PageHeader title=… subtitle=… backHref=… actions=… />` per the per-screen table.
4. Move any header action buttons (filter, New, Edit, etc.) into the `actions` prop.
5. In the screen's `*.module.css`, **delete** `.page`, `.head`, `.heading`,
   `.subhead`/`.subhead`-like rules (and the responsive `.heading` overrides).
   **Keep** body rules (`.list`, `.center`, `.grid`, `.group`, section styles, etc.).
6. Run `pnpm --filter web test -- <screen>` → existing page test still passes.
7. Commit (one per screen).

---

## Task 3: Migrate inbox, settings, household, people

Per-screen `PageHeader`:

| Screen | PageHeader |
|---|---|
| `/inbox` | `title="Inbox" subtitle="Everything you've captured, ready to sort."` |
| `/settings` | `title="Settings"` (no subtitle) |
| `/household` | `title="Household" subtitle="Groceries and supplies, shared and up to date."` — and the `SegmentedControl` tab row stays in the body (outside `PageHeader`) |
| `/people` | `title="People" subtitle="The people in your life, and what matters to them." actions={<Button …>New person</Button>}` |

- [ ] **Step 1–4 (inbox):** apply the recipe; remove `.page/.head/.heading/.subhead/.center?`→ keep `.center` and `.list`. Run `pnpm --filter web test -- inbox/page`. Commit `refactor(web): inbox uses PageShell/PageHeader`.
- [ ] **Step 5–8 (settings):** apply recipe (keep the three section cards in body). Run `pnpm --filter web test -- settings/page`. Commit `refactor(web): settings uses PageShell/PageHeader`.
- [ ] **Step 9–12 (household):** apply recipe; keep the tab `SegmentedControl` + groups in body; **this removes the `--font-display` bug** (the bad `.heading` rule is deleted). Run `pnpm --filter web test -- household/page`. Commit `refactor(web): household uses PageShell/PageHeader (fixes --font-display)`.
- [ ] **Step 13–16 (people):** apply recipe; the `New person` Button → `actions`; keep upcoming strip + list in body. Run `pnpm --filter web test -- people/page`. Commit `refactor(web): people uses PageShell/PageHeader`.

> Each screen: after editing, also delete the now-orphaned page-shell CSS rules from its `*.module.css`. If a body rule referenced `.page` (e.g. a descendant selector), re-point it.

---

## Task 4: Migrate projects, projects/[id], people/[id]

| Screen | PageHeader |
|---|---|
| `/projects` | `title="Projects" subtitle="Everything you're working on, by type." actions={<>{statusFilterButton}{newProjectButton}</>}` |
| `/projects/[id]` | `backHref="/projects" title={<><icon/> {project.title}</>} actions={<>Edit / Archive / Complete</>}` (keep the existing back `<Link>`? → replace it with `PageHeader`'s `backHref`) |
| `/people/[id]` | `backHref="/people" title={person.name} subtitle={person.relationship ?? undefined} actions={<>Edit / Delete(confirm)</>}` |

- [ ] **Step 1–4 (projects list):** move the status-filter button + New project button into `actions`; keep the grouped grid in body. Run `pnpm --filter web test -- "projects/page"`. Commit `refactor(web): projects list uses PageShell/PageHeader`.
- [ ] **Step 5–8 (projects/[id]):** replace the manual back `<Link href="/projects">` with `PageHeader backHref`; the type icon + title go in `title`; Edit/Archive/Complete in `actions`. The progress bar / fields / tasks stay in body. Run `pnpm --filter web test -- "projects/\[id\]/page"` (the test asserts the title heading + tasks — keep green). Commit `refactor(web): project detail uses PageShell/PageHeader`.
- [ ] **Step 9–12 (people/[id]):** replace its back link + header with `PageHeader` (backHref, name title, relationship subtitle, Edit + confirm-Delete actions). Keep contact/dates/notes/gift sections in body. The `Avatar` can sit beside the title via `actions`/title node, or stay as the first body element — keep the test green (`getByRole('heading', { name: 'Mum' })`). Run `pnpm --filter web test -- "people/\[id\]/page"`. Commit `refactor(web): person detail uses PageShell/PageHeader`.

> **person/[id] note:** the page test asserts the delete-confirm flow + `getByRole('heading', { name: 'Mum' })`. Keep the name as the `PageHeader` title (h1) and keep the Edit/Delete buttons reachable (in `actions`). Verify the confirm-delete two-step still works inside `actions`.

---

## Task 5: Migrate calendar + dashboard (custom headers)

These keep bespoke headers **inside** `PageShell` (no `PageHeader`), but adopt the
uniform column. Align their title font to `--ls-font-display`.

- [ ] **Step 1–4 (calendar):** wrap the page body in `<PageShell>`; keep the month
  prev/title/next + Today header as-is (it's a control row, not a page title).
  Delete the calendar `.page` max-width/padding rules (now from `PageShell`); keep
  `.head/.nav/.title` (the month control) and grid styles. Run
  `pnpm --filter web test -- calendar/page`. Commit `refactor(web): calendar uses PageShell`.
- [ ] **Step 5–8 (dashboard):** wrap in `<PageShell>`; keep the eyebrow greeting +
  `<h1>` + date header; change the dashboard `.heading` to `--ls-text-3xl` (from
  `4xl`) for uniformity; delete the dashboard `.page` rule (PageShell owns the
  column) but keep `gap` via PageShell. **Manually verify** the 7-block body still
  reads well at 900px (if the grid needs more room, that's the one place to keep a
  wider local wrapper — note it). Run `pnpm --filter web test -- dashboard`. Commit
  `refactor(web): dashboard uses PageShell`.

---

## Task 6: Mobile "More" menu

**Files:** `apps/web/src/components/app-shell/nav-items.tsx`,
`apps/web/src/components/app-shell/BottomNav.tsx` (+ `BottomNav.module.css`),
`apps/web/src/components/app-shell/MoreSheet.tsx` (+ `.module.css`, `.test.tsx`).

- [ ] **Step 1: Write the failing BottomNav test**

`apps/web/src/components/app-shell/BottomNav.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));

import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
  it('renders the primary tabs and a More button', () => {
    render(<BottomNav onQuickCapture={() => {}} />);
    expect(screen.getByRole('link', { name: /Home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Projects/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /More/i })).toBeInTheDocument();
  });

  it('opens the More sheet with Calendar, People, and Settings', async () => {
    render(<BottomNav onQuickCapture={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /More/i }));
    expect(screen.getByRole('link', { name: /Calendar/i })).toHaveAttribute('href', '/calendar');
    expect(screen.getByRole('link', { name: /People/i })).toHaveAttribute('href', '/people');
    expect(screen.getByRole('link', { name: /Settings/i })).toHaveAttribute('href', '/settings');
  });
});
```

- [ ] **Step 2: Run → fail.** `pnpm --filter web test -- BottomNav`

- [ ] **Step 3: Add `moreNavItems`**

In `nav-items.tsx`, after `bottomNavItems`, add:
```tsx
/** Destinations behind the mobile bottom-bar "More" button. */
export const moreNavItems: NavItem[] = [
  { label: 'Calendar', href: '/calendar', icon: <CalendarIcon /> },
  { label: 'People', href: '/people', icon: <PeopleIcon /> },
  { label: 'Settings', href: '/settings', icon: <SettingsIcon /> },
];
```
(`CalendarIcon`, `PeopleIcon`, `SettingsIcon` are already imported for `navItems`.)

- [ ] **Step 4: Write `MoreSheet`**

`apps/web/src/components/app-shell/MoreSheet.tsx`:
```tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@lifesync/ui';
import { moreNavItems } from './nav-items';
import styles from './MoreSheet.module.css';

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const pathname = usePathname();
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="More">
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        {moreNavItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(styles.row, active && styles.active)}
              onClick={onClose}
            >
              <span className={styles.icon} aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

`apps/web/src/components/app-shell/MoreSheet.module.css`:
```css
.overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: flex-end;
  background: var(--ls-surface-overlay);
}

.sheet {
  width: 100%;
  background: var(--ls-surface-elevated);
  border-top-left-radius: var(--ls-radius-2xl);
  border-top-right-radius: var(--ls-radius-2xl);
  padding: var(--ls-space-4);
  padding-bottom: calc(var(--ls-space-6) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: var(--ls-space-1);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--ls-space-3);
  min-height: 44px;
  padding: 0 var(--ls-space-3);
  border-radius: var(--ls-radius-md);
  text-decoration: none;
  color: var(--ls-text-primary);
  font-size: var(--ls-text-base);
}

.row:hover,
.active {
  background: var(--ls-surface-sunken);
}

.icon {
  display: inline-flex;
  color: var(--ls-text-secondary);
}
```

- [ ] **Step 5: Wire `BottomNav`**

Edit `apps/web/src/components/app-shell/BottomNav.tsx`:
```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@lifesync/ui';
import { PlusIcon, MenuIcon } from '../icons';
import { bottomNavItems, moreNavItems, type NavItem } from './nav-items';
import { MoreSheet } from './MoreSheet';
import styles from './BottomNav.module.css';

export function BottomNav({ onQuickCapture }: { onQuickCapture: () => void }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const renderLink = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(styles.tab, active && styles.active)}
        aria-current={active ? 'page' : undefined}
      >
        <span className={styles.icon}>{item.icon}</span>
        <span className={styles.label}>{item.label}</span>
      </Link>
    );
  };

  const moreActive = moreNavItems.some(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );

  return (
    <>
      <nav className={styles.bar} aria-label="Primary">
        {bottomNavItems.slice(0, 2).map(renderLink)}

        <button type="button" className={styles.fab} onClick={onQuickCapture} aria-label="Quick capture">
          <PlusIcon size={24} />
        </button>

        {bottomNavItems.slice(2).map(renderLink)}

        <button
          type="button"
          className={cn(styles.tab, moreActive && styles.active)}
          aria-current={moreActive ? 'page' : undefined}
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen(true)}
        >
          <span className={styles.icon}>
            <MenuIcon />
          </span>
          <span className={styles.label}>More</span>
        </button>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
```

> If `MenuIcon` doesn't exist in `@/components/icons`, add a simple one (three horizontal lines) following the existing `Icon` pattern in `apps/web/src/components/icons.tsx`, or reuse an existing icon (e.g. a "more" dots glyph). Confirm before using.

- [ ] **Step 6: Run → pass.** `pnpm --filter web test -- BottomNav` (2 tests).

- [ ] **Step 7: Commit**
```bash
git add apps/web/src/components/app-shell/nav-items.tsx apps/web/src/components/app-shell/BottomNav.tsx apps/web/src/components/app-shell/BottomNav.module.css apps/web/src/components/app-shell/MoreSheet.tsx apps/web/src/components/app-shell/MoreSheet.module.css apps/web/src/components/app-shell/BottomNav.test.tsx
git commit -m "feat(web): mobile bottom-nav More menu (Calendar/People/Settings)"
```

---

## Task 7: Verification & docs

- [ ] **Step 1: Build, typecheck, web lint, full suite**
```bash
pnpm --filter @lifesync/ui build
pnpm typecheck
pnpm --filter web lint
pnpm test
```
Expected: typecheck clean; web lint clean; **all tests pass** — every migrated screen's existing page test green; new `PageShell` (1), `PageHeader` (2), `BottomNav` (2). Update the count in `CLAUDE.md`.

- [ ] **Step 2: Manual smoke (recommended)**

`pnpm dev --filter=web`:
- Every screen has the same column width, padding, and `<h1>` size; headers line up.
- Household heading uses the real display font (not the literal fallback).
- Resize to mobile width → bottom bar shows Home · Inbox · (＋) · Projects · Household · More; tapping More opens the sheet → Calendar / People / Settings navigate and the More tab shows active on those routes.
- Detail pages (project/person) show a back link, title, and actions correctly.

- [ ] **Step 3: Update CLAUDE.md**

- Bump the test-count line.
- In the Web "Done ✅" bullet, note the shared `PageShell`/`PageHeader` (15 UI components now) and the mobile "More" menu; note the `--font-display` bug is fixed.

- [ ] **Step 4: Commit**
```bash
git add CLAUDE.md
git commit -m "docs: note PageShell/PageHeader + mobile More in status"
```

---

## Self-Review Notes (verified against the spec)

- **§3.1 PageShell (uniform 56rem width, padding, gap)** → Task 1.
- **§3.2 PageHeader (title h1 @ text-3xl, subtitle, backHref, actions)** → Task 2.
- **§4 migrate all 9 screens; delete bespoke chrome CSS; fix --font-display** → Tasks 3–5 (recipe + per-screen tables); household fix in Task 3.
- **§5 mobile More (nav split, BottomNav + active state, MoreSheet bottom sheet)** → Task 6.
- **§6 tests (PageShell/PageHeader; BottomNav opens sheet w/ correct hrefs; migrated page tests pass unchanged)** → Tasks 1, 2, 6 + per-screen re-runs.
- **§7 risks (one commit per screen; calendar/dashboard custom-header exception; heading size change intentional)** → Tasks 3–5 structure.
- **Type/name consistency:** `PageShell`, `PageHeader({ title, subtitle, backHref, actions })`, `bottomNavItems` (4) + `moreNavItems` (Calendar/People/Settings), `MoreSheet({ open, onClose })`, `getByRole('heading', { name })` preserved across migrations.
