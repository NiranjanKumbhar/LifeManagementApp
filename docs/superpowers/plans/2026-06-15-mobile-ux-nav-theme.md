# Mobile UX + Theme Switching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the cramped/off-center mobile bottom nav and the Inbox horizontal-overflow bug, and add a System/Light/Dark theme switcher.

**Architecture:** Pure web-app changes (`apps/web`) plus a dark-theme token block. The nav becomes a 5-cell grid with a centered FAB and 4 tabs (Household moves into the "More" sheet). Theme is driven by `data-theme` on `<html>`, overriding existing `--ls-*` CSS variables; a React `ThemeProvider` persists the choice in `localStorage` and an inline `<head>`-script applies it pre-paint to avoid a flash.

**Tech Stack:** Next.js 15 App Router, React 18, CSS Modules + CSS custom properties, `@lifesync/ui` (`SegmentedControl`, `SectionCard`), Vitest + React Testing Library.

Spec: `docs/superpowers/specs/2026-06-15-mobile-ux-nav-theme-design.md`.

## File map

- `apps/web/src/components/app-shell/nav-items.tsx` — modify item lists (Task 1)
- `apps/web/src/components/app-shell/BottomNav.module.css` — 6→5 column grid (Task 1)
- `apps/web/src/components/app-shell/BottomNav.test.tsx` — updated expectations (Task 1)
- `apps/web/src/components/inbox/InboxItemRow.module.css` — overflow fix (Task 2)
- `apps/web/src/styles/variables.css` — `[data-theme="dark"]` block (Task 3)
- `apps/web/src/lib/theme.tsx` — **create** `ThemeProvider` + `useTheme` (Task 4)
- `apps/web/src/lib/theme.test.tsx` — **create** provider test (Task 4)
- `apps/web/src/lib/providers.tsx` — mount `ThemeProvider` (Task 4)
- `apps/web/src/app/layout.tsx` — inline no-flash script (Task 4)
- `apps/web/src/components/settings/AppearanceSettings.tsx` — **create** (Task 5)
- `apps/web/src/components/settings/AppearanceSettings.test.tsx` — **create** (Task 5)
- `apps/web/src/app/(app)/settings/page.tsx` — render Appearance section (Task 5)

---

### Task 1: Bottom nav — centered FAB, 4 tabs

**Files:**
- Modify: `apps/web/src/components/app-shell/nav-items.tsx`
- Modify: `apps/web/src/components/app-shell/BottomNav.module.css`
- Test: `apps/web/src/components/app-shell/BottomNav.test.tsx`

- [ ] **Step 1: Update the test to the new layout**

Replace the body of `BottomNav.test.tsx` with:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));

import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
  it('renders Home, Inbox, Projects tabs, the capture FAB, and a More button', () => {
    render(<BottomNav onQuickCapture={() => {}} />);
    expect(screen.getByRole('link', { name: /Home/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /Inbox/i })).toHaveAttribute('href', '/inbox');
    expect(screen.getByRole('link', { name: /Projects/i })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('button', { name: /Quick capture/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /More/i })).toBeInTheDocument();
    // Household is no longer a top-level tab.
    expect(screen.queryByRole('link', { name: /Household/i })).not.toBeInTheDocument();
  });

  it('opens the More sheet with Household, Calendar, People, and Settings', async () => {
    render(<BottomNav onQuickCapture={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /More/i }));
    expect(screen.getByRole('link', { name: /Household/i })).toHaveAttribute('href', '/household');
    expect(screen.getByRole('link', { name: /Calendar/i })).toHaveAttribute('href', '/calendar');
    expect(screen.getByRole('link', { name: /People/i })).toHaveAttribute('href', '/people');
    expect(screen.getByRole('link', { name: /Settings/i })).toHaveAttribute('href', '/settings');
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm --filter=web test -- BottomNav`
Expected: FAIL — Household still renders as a top-level link (current `bottomNavItems` includes Household).

- [ ] **Step 3: Update the nav item lists**

In `apps/web/src/components/app-shell/nav-items.tsx`, replace the `bottomNavItems` and `moreNavItems` definitions with:

```tsx
/**
 * Condensed set for the mobile bottom bar (Home, Inbox + centered FAB + Projects).
 * Inbox sits beside the capture FAB so the capture → triage loop is reachable on
 * the go. Household / Calendar / People / Settings live in the "More" overflow sheet.
 */
export const bottomNavItems: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: <HomeIcon /> },
  { label: 'Inbox', href: '/inbox', icon: <InboxIcon /> },
  { label: 'Projects', href: '/projects', icon: <ProjectsIcon /> },
];

/** Destinations behind the mobile bottom-bar "More" button. */
export const moreNavItems: NavItem[] = [
  { label: 'Household', href: '/household', icon: <HouseholdIcon /> },
  { label: 'Calendar', href: '/calendar', icon: <CalendarIcon /> },
  { label: 'People', href: '/people', icon: <PeopleIcon /> },
  { label: 'Settings', href: '/settings', icon: <SettingsIcon /> },
];
```

`BottomNav.tsx` needs no change: it renders `bottomNavItems.slice(0, 2)` (Home, Inbox), the FAB, then `bottomNavItems.slice(2)` (Projects), then the More button — exactly the 5 cells we want. `MoreSheet` already maps `moreNavItems`, so Household flows through automatically.

- [ ] **Step 4: Update the grid to 5 columns**

In `apps/web/src/components/app-shell/BottomNav.module.css`, change the `.bar` grid:

```css
.bar {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 30;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: center;
  padding: 0.4rem 0.5rem calc(0.4rem + env(safe-area-inset-bottom, 0px));
  background-color: var(--ls-surface-elevated);
  border-top: 1px solid var(--ls-surface-border);
  box-shadow: 0 -4px 16px rgba(60, 45, 30, 0.06);
}
```

(Only `grid-template-columns: repeat(6, 1fr)` → `repeat(5, 1fr)` changes. The `.fab` already uses `justify-self: center`, so in 5 cells it lands dead-center.)

- [ ] **Step 5: Run the test, expect pass**

Run: `pnpm --filter=web test -- BottomNav`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/app-shell/nav-items.tsx apps/web/src/components/app-shell/BottomNav.module.css apps/web/src/components/app-shell/BottomNav.test.tsx
git commit -m "fix(web): center bottom-nav FAB with 4 tabs; move Household into More"
```

---

### Task 2: Inbox row — stop horizontal overflow on mobile

**Files:**
- Modify: `apps/web/src/components/inbox/InboxItemRow.module.css`

This is a CSS layout fix (not unit-testable); verify manually at the end.

- [ ] **Step 1: Let the project `<select>` shrink instead of widening the page**

Replace the `.actions`, `.select`, and the `@media (max-width: 600px)` block in `apps/web/src/components/inbox/InboxItemRow.module.css` with:

```css
.actions {
  display: flex;
  align-items: center;
  gap: var(--ls-space-2);
  min-width: 0; /* allow the select to shrink rather than overflow the row */
}

.select {
  font-family: var(--ls-font-body);
  font-size: var(--ls-text-sm);
  color: var(--ls-text-primary);
  background-color: var(--ls-surface-elevated);
  border: 1px solid var(--ls-surface-border-strong);
  border-radius: var(--ls-radius-full);
  padding: 0.4rem 0.85rem;
  cursor: pointer;
  min-width: 0;
  max-width: 14rem;
  text-overflow: ellipsis;
}

@media (max-width: 600px) {
  .row {
    flex-direction: column;
    align-items: stretch;
  }
  .actions {
    justify-content: space-between;
  }
  .select {
    flex: 1 1 auto;
    max-width: 100%;
  }
}
```

(Key changes: `.actions` loses `flex-shrink: 0` and gains `min-width: 0`; `.select` gains `min-width: 0` + `max-width`; on mobile the select fills the stacked row instead of overflowing.)

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/inbox/InboxItemRow.module.css
git commit -m "fix(web): prevent inbox row from overflowing viewport on mobile"
```

---

### Task 3: Dark theme tokens

**Files:**
- Modify: `apps/web/src/styles/variables.css`

- [ ] **Step 1: Add the dark token override block**

Append to the end of `apps/web/src/styles/variables.css` (after the closing `}` of `:root`):

```css
/* Dark theme — warm-dark surfaces, inverted text. Applied via data-theme on <html>.
   Only semantic surface/text/border/shadow/urgency-soft tokens change; the brand
   scale, spacing, radii, typography and motion tokens stay the same. */
[data-theme='dark'] {
  --ls-surface-background: #1a1816;
  --ls-surface-card: #242120;
  --ls-surface-elevated: #2b2826;
  --ls-surface-sunken: #161413;
  --ls-surface-border: #3a3633;
  --ls-surface-border-strong: #4a4541;
  --ls-surface-overlay: rgba(0, 0, 0, 0.55);

  --ls-text-primary: #f5f3f0;
  --ls-text-secondary: #c4beb6;
  --ls-text-tertiary: #8f8881;
  --ls-text-inverse: #1c1917;

  --ls-urgency-overdue-soft: #3a201d;
  --ls-urgency-soon-soft: #3a2e16;
  --ls-urgency-on-track-soft: #14302b;
  --ls-urgency-completed-soft: #163021;

  --ls-shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.4);
  --ls-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.45), 0 1px 2px rgba(0, 0, 0, 0.4);
  --ls-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.4);
  --ls-shadow-lg: 0 12px 28px rgba(0, 0, 0, 0.55), 0 4px 8px rgba(0, 0, 0, 0.4);
  --ls-shadow-xl: 0 24px 48px rgba(0, 0, 0, 0.6), 0 8px 16px rgba(0, 0, 0, 0.45);
  --ls-shadow-focus: 0 0 0 3px rgba(45, 212, 191, 0.4);
}
```

(`[data-theme='dark']` has the same specificity as `:root` but comes later in source order, so it wins. Components already read these tokens, so no component CSS changes are needed.)

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/styles/variables.css
git commit -m "feat(web): add dark theme design tokens"
```

---

### Task 4: ThemeProvider + no-flash script

**Files:**
- Create: `apps/web/src/lib/theme.tsx`
- Create: `apps/web/src/lib/theme.test.tsx`
- Modify: `apps/web/src/lib/providers.tsx`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Write the failing provider test**

Create `apps/web/src/lib/theme.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './theme';

function Probe() {
  const { mode, setMode } = useTheme();
  return (
    <div>
      <span data-testid="mode">{mode}</span>
      <button onClick={() => setMode('dark')}>set dark</button>
    </div>
  );
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

describe('ThemeProvider', () => {
  it('defaults to system and resolves to light when the OS is light', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('mode')).toHaveTextContent('system');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('persists an explicit choice to localStorage and sets data-theme', async () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'set dark' }));
    expect(localStorage.getItem('ls-theme')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm --filter=web test -- theme`
Expected: FAIL — `./theme` module does not exist.

- [ ] **Step 3: Implement the provider**

Create `apps/web/src/lib/theme.tsx`:

```tsx
'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'ls-theme';

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolve(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

function apply(mode: ThemeMode): void {
  document.documentElement.dataset.theme = resolve(mode);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Load the persisted choice on mount (client only).
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setModeState(stored);
    }
  }, []);

  // Apply the theme, and while in "system" mode, follow OS changes live.
  useEffect(() => {
    apply(mode);
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [mode]);

  const setMode = (next: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, next);
    setModeState(next);
  };

  return <ThemeContext.Provider value={{ mode, setMode }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm --filter=web test -- theme`
Expected: PASS (both tests).

- [ ] **Step 5: Mount the provider**

In `apps/web/src/lib/providers.tsx`, import the provider and wrap the tree. Change the import block to add:

```tsx
import { ThemeProvider } from './theme';
```

And change the `Providers` export to:

```tsx
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ThemeProvider>
        <TRPCProvider>
          <ToastProvider>{children}</ToastProvider>
        </TRPCProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}
```

- [ ] **Step 6: Add the no-flash inline script**

In `apps/web/src/app/layout.tsx`, render an inline script as the first child of `<body>` so the theme is applied before the rest of the body paints. Change the returned JSX to:

```tsx
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var m=localStorage.getItem('ls-theme');var d=m==='dark'||((m===null||m==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();",
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
```

- [ ] **Step 7: Run the web test suite, expect pass**

Run: `pnpm --filter=web test`
Expected: PASS (all web tests, including the new theme test).

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/lib/theme.tsx apps/web/src/lib/theme.test.tsx apps/web/src/lib/providers.tsx apps/web/src/app/layout.tsx
git commit -m "feat(web): theme provider with system/light/dark + no-flash script"
```

---

### Task 5: Appearance section in Settings

**Files:**
- Create: `apps/web/src/components/settings/AppearanceSettings.tsx`
- Create: `apps/web/src/components/settings/AppearanceSettings.test.tsx`
- Modify: `apps/web/src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Write the failing component test**

Create `apps/web/src/components/settings/AppearanceSettings.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@/lib/theme';
import { AppearanceSettings } from './AppearanceSettings';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

describe('AppearanceSettings', () => {
  it('selects the active mode and switches theme on click', async () => {
    render(
      <ThemeProvider>
        <AppearanceSettings />
      </ThemeProvider>,
    );
    // Defaults to System selected.
    expect(screen.getByRole('tab', { name: 'System' })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: 'Dark' }));
    expect(screen.getByRole('tab', { name: 'Dark' })).toHaveAttribute('aria-selected', 'true');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('ls-theme')).toBe('dark');
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `pnpm --filter=web test -- AppearanceSettings`
Expected: FAIL — `./AppearanceSettings` does not exist.

- [ ] **Step 3: Implement the component**

Create `apps/web/src/components/settings/AppearanceSettings.tsx`:

```tsx
'use client';

import { SegmentedControl } from '@lifesync/ui';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { SectionCard } from './SectionCard';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function AppearanceSettings() {
  const { mode, setMode } = useTheme();
  return (
    <SectionCard title="Appearance">
      <SegmentedControl
        options={THEME_OPTIONS}
        value={mode}
        onChange={(v) => setMode(v as ThemeMode)}
        ariaLabel="Color theme"
      />
    </SectionCard>
  );
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `pnpm --filter=web test -- AppearanceSettings`
Expected: PASS.

- [ ] **Step 5: Render the section on the Settings page**

In `apps/web/src/app/(app)/settings/page.tsx`, add the import:

```tsx
import { AppearanceSettings } from '@/components/settings/AppearanceSettings';
```

And render it first in the `PageShell`, right after `<PageHeader title="Settings" />`:

```tsx
    <PageShell>
      <PageHeader title="Settings" />
      <AppearanceSettings />
      <ProfileSettings me={me} />
      <NotificationSettings me={me} />
      <WorkspaceSettings
        workspace={workspaceQuery.data}
        members={membersQuery.data ?? []}
        currentUserId={me.id}
      />
    </PageShell>
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/settings/AppearanceSettings.tsx apps/web/src/components/settings/AppearanceSettings.test.tsx "apps/web/src/app/(app)/settings/page.tsx"
git commit -m "feat(web): Appearance theme switcher in Settings"
```

---

### Task 6: Full verification & deploy

**Files:** none (verification only)

- [ ] **Step 1: Run the full web test suite**

Run: `pnpm --filter=web test`
Expected: PASS (all web tests green).

- [ ] **Step 2: Production build**

Run: `pnpm --filter=web build`
Expected: `Compiled successfully` and the route table prints with no errors.

- [ ] **Step 3: Manual mobile-width check (≤390px, e.g. DevTools device toolbar)**

Verify:
- Bottom nav: 4 tabs + a centered "+"; not cramped.
- "More" sheet shows Household, Calendar, People, Settings.
- Inbox: no horizontal scrolling, even with a long project name in the move-to-project select.
- Settings → Appearance: System/Light/Dark switches instantly with no reload; reloading the page keeps the chosen theme (no light flash for Dark).

- [ ] **Step 4: Push (auto-deploys to production via Vercel Git integration)**

```bash
git push origin main
```

Expected: push succeeds; Vercel starts a production deploy automatically. Optionally confirm with the latest deployment status afterward.
