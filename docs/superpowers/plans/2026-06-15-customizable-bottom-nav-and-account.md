# Customizable Bottom-Nav Button + Account Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pick which of five secondary screens occupies the mobile bottom bar's second button (per-device), and show the user's name (with a Clerk account control) in both the desktop sidebar and the mobile More sheet.

**Architecture:** A `localStorage`-backed React context (`nav-prefs`, mirroring the existing `theme` context) holds the chosen second-nav key. `nav-items` exposes a typed registry of the five secondary screens; `BottomNav` renders the selected one and `MoreSheet` renders the other four plus a reusable `AccountControl`. A new Settings card edits the preference. No backend/DB changes; `apps/web` only.

**Tech Stack:** Next.js 15 (client components), React context + `localStorage`, tRPC (`user.me`), Clerk (`UserButton`), `@lifesync/ui` (`Input`, `SectionCard`), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-15-customizable-bottom-nav-and-account-design.md`

---

## File Structure

- `apps/web/src/lib/nav-prefs.tsx` (create) — `NavPrefsProvider` + `useSecondNav()` + `SecondNavKey` type, `localStorage` key `ls-second-nav`.
- `apps/web/src/lib/nav-prefs.test.tsx` (create) — hook/provider behavior.
- `apps/web/src/lib/providers.tsx` (modify) — mount `NavPrefsProvider`.
- `apps/web/src/components/app-shell/AccountControl.tsx` (create) — Clerk `UserButton` + user name.
- `apps/web/src/components/app-shell/AccountControl.module.css` (create).
- `apps/web/src/components/app-shell/AccountControl.test.tsx` (create).
- `apps/web/src/components/app-shell/NavigationSidebar.tsx` (modify) — use `AccountControl` in footer.
- `apps/web/src/components/app-shell/nav-items.tsx` (modify) — add `SECONDARY_NAV`, `SECOND_NAV_ORDER`, `HOME_NAV_ITEM`, `PROJECTS_NAV_ITEM`; remove `bottomNavItems`/`moreNavItems`.
- `apps/web/src/components/app-shell/BottomNav.tsx` (modify) — dynamic second button.
- `apps/web/src/components/app-shell/BottomNav.test.tsx` (modify).
- `apps/web/src/components/app-shell/MoreSheet.tsx` (modify) — filtered list + account footer.
- `apps/web/src/components/app-shell/MoreSheet.module.css` (modify) — account footer style.
- `apps/web/src/components/app-shell/MoreSheet.test.tsx` (modify).
- `apps/web/src/components/settings/NavSettings.tsx` (create) — Settings card.
- `apps/web/src/components/settings/NavSettings.test.tsx` (create).
- `apps/web/src/app/(app)/settings/page.tsx` (modify) — render `NavSettings`.

---

## Task 1: Nav preference store

**Files:**
- Create: `apps/web/src/lib/nav-prefs.tsx`
- Create: `apps/web/src/lib/nav-prefs.test.tsx`
- Modify: `apps/web/src/lib/providers.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/nav-prefs.test.tsx`:

```tsx
import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { NavPrefsProvider, useSecondNav } from './nav-prefs';

const wrapper = ({ children }: { children: ReactNode }) => (
  <NavPrefsProvider>{children}</NavPrefsProvider>
);

describe('nav-prefs', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to inbox', () => {
    const { result } = renderHook(() => useSecondNav(), { wrapper });
    expect(result.current.secondNav).toBe('inbox');
  });

  it('persists and updates the selection', () => {
    const { result } = renderHook(() => useSecondNav(), { wrapper });
    act(() => result.current.setSecondNav('calendar'));
    expect(result.current.secondNav).toBe('calendar');
    expect(localStorage.getItem('ls-second-nav')).toBe('calendar');
  });

  it('reads a stored value', () => {
    localStorage.setItem('ls-second-nav', 'people');
    const { result } = renderHook(() => useSecondNav(), { wrapper });
    expect(result.current.secondNav).toBe('people');
  });

  it('falls back to inbox for an invalid stored value', () => {
    localStorage.setItem('ls-second-nav', 'bogus');
    const { result } = renderHook(() => useSecondNav(), { wrapper });
    expect(result.current.secondNav).toBe('inbox');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter=web test -- nav-prefs`
Expected: FAIL — `Cannot find module './nav-prefs'`.

- [ ] **Step 3: Create the store**

Create `apps/web/src/lib/nav-prefs.tsx`:

```tsx
'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type SecondNavKey = 'inbox' | 'household' | 'calendar' | 'people' | 'settings';

const STORAGE_KEY = 'ls-second-nav';
const VALID: SecondNavKey[] = ['inbox', 'household', 'calendar', 'people', 'settings'];

/** Read the persisted choice. Returns 'inbox' on the server or when unset/invalid. */
function readStored(): SecondNavKey {
  if (typeof window === 'undefined') return 'inbox';
  const stored = localStorage.getItem(STORAGE_KEY);
  return VALID.includes(stored as SecondNavKey) ? (stored as SecondNavKey) : 'inbox';
}

interface NavPrefsContextValue {
  secondNav: SecondNavKey;
  setSecondNav: (key: SecondNavKey) => void;
}

const NavPrefsContext = createContext<NavPrefsContextValue | null>(null);

export function NavPrefsProvider({ children }: { children: ReactNode }) {
  // Lazy initializer reads the persisted choice on the first client render.
  const [secondNav, setSecondNavState] = useState<SecondNavKey>(readStored);

  const setSecondNav = useCallback((next: SecondNavKey) => {
    localStorage.setItem(STORAGE_KEY, next);
    setSecondNavState(next);
  }, []);

  const value = useMemo(() => ({ secondNav, setSecondNav }), [secondNav, setSecondNav]);

  return <NavPrefsContext.Provider value={value}>{children}</NavPrefsContext.Provider>;
}

export function useSecondNav(): NavPrefsContextValue {
  const ctx = useContext(NavPrefsContext);
  if (!ctx) throw new Error('useSecondNav must be used within a NavPrefsProvider');
  return ctx;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter=web test -- nav-prefs`
Expected: PASS (4 tests).

- [ ] **Step 5: Mount the provider**

In `apps/web/src/lib/providers.tsx`, add the import after the `ThemeProvider` import (line 9):

```tsx
import { NavPrefsProvider } from './nav-prefs';
```

Then wrap the tree — change the `Providers` return so `NavPrefsProvider` sits inside `ThemeProvider` and around `TRPCProvider`:

```tsx
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <ThemeProvider>
        <NavPrefsProvider>
          <TRPCProvider>
            <ToastProvider>{children}</ToastProvider>
          </TRPCProvider>
        </NavPrefsProvider>
      </ThemeProvider>
    </ClerkProvider>
  );
}
```

- [ ] **Step 6: Verify typecheck and commit**

Run: `pnpm --filter=web typecheck`
Expected: no errors.

```bash
git add apps/web/src/lib/nav-prefs.tsx apps/web/src/lib/nav-prefs.test.tsx apps/web/src/lib/providers.tsx
git commit -m "feat(web): per-device nav preference store (second bottom-bar button)"
```

---

## Task 2: AccountControl component (name instead of "Your account")

**Files:**
- Create: `apps/web/src/components/app-shell/AccountControl.tsx`
- Create: `apps/web/src/components/app-shell/AccountControl.module.css`
- Create: `apps/web/src/components/app-shell/AccountControl.test.tsx`
- Modify: `apps/web/src/components/app-shell/NavigationSidebar.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/app-shell/AccountControl.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@clerk/nextjs', () => ({ UserButton: () => <div data-testid="user-button" /> }));

const useMeMock = vi.fn();
vi.mock('@/lib/trpc', () => ({ trpc: { user: { me: { useQuery: () => useMeMock() } } } }));

import { AccountControl } from './AccountControl';

describe('AccountControl', () => {
  it('shows the user display name and the account button', () => {
    useMeMock.mockReturnValue({ data: { displayName: 'Alex Rivera' } });
    render(<AccountControl />);
    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByTestId('user-button')).toBeInTheDocument();
  });

  it('falls back to "Your account" when there is no data', () => {
    useMeMock.mockReturnValue({ data: undefined });
    render(<AccountControl />);
    expect(screen.getByText('Your account')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter=web test -- AccountControl`
Expected: FAIL — `Cannot find module './AccountControl'`.

- [ ] **Step 3: Create the component**

Create `apps/web/src/components/app-shell/AccountControl.tsx`:

```tsx
'use client';

import { UserButton } from '@clerk/nextjs';
import { trpc } from '@/lib/trpc';
import styles from './AccountControl.module.css';

export function AccountControl() {
  const me = trpc.user.me.useQuery();
  const name = me.data?.displayName ?? 'Your account';
  return (
    <div className={styles.account}>
      <UserButton />
      <span className={styles.name}>{name}</span>
    </div>
  );
}
```

- [ ] **Step 4: Create the styles**

Create `apps/web/src/components/app-shell/AccountControl.module.css`:

```css
.account {
  display: flex;
  align-items: center;
  gap: var(--ls-space-2);
}
.name {
  font-size: var(--ls-text-sm);
  color: var(--ls-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter=web test -- AccountControl`
Expected: PASS (2 tests).

- [ ] **Step 6: Use it in the sidebar**

In `apps/web/src/components/app-shell/NavigationSidebar.tsx`:

Remove the Clerk import line:

```tsx
import { UserButton } from '@clerk/nextjs';
```

Add this import after the `nav-items` import (line 7):

```tsx
import { AccountControl } from './AccountControl';
```

Replace the footer block (currently `<UserButton />` + `<span className={styles.footerHint}>Your account</span>`):

```tsx
      <div className={styles.footer}>
        <AccountControl />
      </div>
```

- [ ] **Step 7: Verify typecheck and commit**

Run: `pnpm --filter=web typecheck`
Expected: no errors.

```bash
git add apps/web/src/components/app-shell/AccountControl.tsx apps/web/src/components/app-shell/AccountControl.module.css apps/web/src/components/app-shell/AccountControl.test.tsx apps/web/src/components/app-shell/NavigationSidebar.tsx
git commit -m "feat(web): AccountControl shows the user's name; use it in the sidebar"
```

---

## Task 3: Dynamic second button (nav-items + BottomNav + MoreSheet)

This task changes the `nav-items` contract and both its consumers together so the build/tests stay green.

**Files:**
- Modify: `apps/web/src/components/app-shell/nav-items.tsx`
- Modify: `apps/web/src/components/app-shell/BottomNav.tsx`
- Modify: `apps/web/src/components/app-shell/BottomNav.test.tsx`
- Modify: `apps/web/src/components/app-shell/MoreSheet.tsx`
- Modify: `apps/web/src/components/app-shell/MoreSheet.module.css`
- Modify: `apps/web/src/components/app-shell/MoreSheet.test.tsx`

- [ ] **Step 1: Update the tests first (they will fail)**

Replace the entire contents of `apps/web/src/components/app-shell/BottomNav.test.tsx` with:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('./AccountControl', () => ({ AccountControl: () => <div>account</div> }));

import { NavPrefsProvider } from '@/lib/nav-prefs';
import { BottomNav } from './BottomNav';

const renderNav = () =>
  render(
    <NavPrefsProvider>
      <BottomNav onQuickCapture={() => {}} />
    </NavPrefsProvider>,
  );

describe('BottomNav', () => {
  beforeEach(() => localStorage.clear());

  it('renders Home, Inbox, Projects tabs, the capture FAB, and a More button', () => {
    renderNav();
    expect(screen.getByRole('link', { name: /Home/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /Inbox/i })).toHaveAttribute('href', '/inbox');
    expect(screen.getByRole('link', { name: /Projects/i })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('button', { name: /Quick capture/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /More/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Household/i })).not.toBeInTheDocument();
  });

  it('opens the More sheet with Household, Calendar, People, and Settings', async () => {
    renderNav();
    await userEvent.click(screen.getByRole('button', { name: /More/i }));
    expect(screen.getByRole('link', { name: /Household/i })).toHaveAttribute('href', '/household');
    expect(screen.getByRole('link', { name: /Calendar/i })).toHaveAttribute('href', '/calendar');
    expect(screen.getByRole('link', { name: /People/i })).toHaveAttribute('href', '/people');
    expect(screen.getByRole('link', { name: /Settings/i })).toHaveAttribute('href', '/settings');
  });

  it('shows the chosen second button instead of Inbox', () => {
    localStorage.setItem('ls-second-nav', 'calendar');
    renderNav();
    expect(screen.getByRole('link', { name: /Calendar/i })).toHaveAttribute('href', '/calendar');
    expect(screen.queryByRole('link', { name: /Inbox/i })).not.toBeInTheDocument();
  });
});
```

Replace the entire contents of `apps/web/src/components/app-shell/MoreSheet.test.tsx` with:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('./AccountControl', () => ({ AccountControl: () => <div>account-control</div> }));

import { NavPrefsProvider } from '@/lib/nav-prefs';
import { MoreSheet } from './MoreSheet';

const renderSheet = (props: { open: boolean; onClose: () => void }) =>
  render(
    <NavPrefsProvider>
      <MoreSheet {...props} />
    </NavPrefsProvider>,
  );

describe('MoreSheet', () => {
  beforeEach(() => localStorage.clear());

  it('renders nothing when closed', () => {
    const { container } = renderSheet({ open: false, onClose: () => {} });
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the overflow destinations (excluding the promoted screen) and the account', () => {
    renderSheet({ open: true, onClose: () => {} });
    expect(screen.getByRole('link', { name: /Household/i })).toHaveAttribute('href', '/household');
    expect(screen.getByRole('link', { name: /Calendar/i })).toHaveAttribute('href', '/calendar');
    expect(screen.getByRole('link', { name: /People/i })).toHaveAttribute('href', '/people');
    expect(screen.getByRole('link', { name: /Settings/i })).toHaveAttribute('href', '/settings');
    // Inbox is the default second button, so it is NOT in the overflow.
    expect(screen.queryByRole('link', { name: /Inbox/i })).not.toBeInTheDocument();
    expect(screen.getByText('account-control')).toBeInTheDocument();
  });

  it('closes on backdrop click', async () => {
    const onClose = vi.fn();
    renderSheet({ open: true, onClose });
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    renderSheet({ open: true, onClose });
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter=web test -- BottomNav MoreSheet`
Expected: FAIL — `NavPrefsProvider`/new exports not wired into the components yet (e.g. components still import removed `bottomNavItems`, or the "chosen second button" test fails).

- [ ] **Step 3: Refactor nav-items**

Replace the entire contents of `apps/web/src/components/app-shell/nav-items.tsx` with:

```tsx
import type { ReactNode } from 'react';
import type { SecondNavKey } from '@/lib/nav-prefs';
import {
  CalendarIcon,
  HomeIcon,
  HouseholdIcon,
  InboxIcon,
  PeopleIcon,
  ProjectsIcon,
  SettingsIcon,
} from '../icons';

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

/** Full navigation set — used by the desktop sidebar. */
export const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <HomeIcon /> },
  { label: 'Inbox', href: '/inbox', icon: <InboxIcon /> },
  { label: 'Projects', href: '/projects', icon: <ProjectsIcon /> },
  { label: 'Household', href: '/household', icon: <HouseholdIcon /> },
  { label: 'Calendar', href: '/calendar', icon: <CalendarIcon /> },
  { label: 'People', href: '/people', icon: <PeopleIcon /> },
  { label: 'Settings', href: '/settings', icon: <SettingsIcon /> },
];

/** Fixed bottom-bar slots flanking the capture FAB. */
export const HOME_NAV_ITEM: NavItem = { label: 'Home', href: '/dashboard', icon: <HomeIcon /> };
export const PROJECTS_NAV_ITEM: NavItem = { label: 'Projects', href: '/projects', icon: <ProjectsIcon /> };

/**
 * The five "secondary" screens. One occupies the customizable second bottom-bar
 * slot (per-device preference, see lib/nav-prefs); the other four fill the "More"
 * overflow sheet.
 */
export const SECONDARY_NAV: Record<SecondNavKey, NavItem> = {
  inbox: { label: 'Inbox', href: '/inbox', icon: <InboxIcon /> },
  household: { label: 'Household', href: '/household', icon: <HouseholdIcon /> },
  calendar: { label: 'Calendar', href: '/calendar', icon: <CalendarIcon /> },
  people: { label: 'People', href: '/people', icon: <PeopleIcon /> },
  settings: { label: 'Settings', href: '/settings', icon: <SettingsIcon /> },
};

/** Display order for pickers and the overflow sheet. */
export const SECOND_NAV_ORDER: SecondNavKey[] = ['inbox', 'household', 'calendar', 'people', 'settings'];
```

- [ ] **Step 4: Update BottomNav**

Replace the entire contents of `apps/web/src/components/app-shell/BottomNav.tsx` with:

```tsx
'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@lifesync/ui';
import { PlusIcon, MenuIcon } from '../icons';
import { useSecondNav } from '@/lib/nav-prefs';
import {
  HOME_NAV_ITEM,
  PROJECTS_NAV_ITEM,
  SECONDARY_NAV,
  SECOND_NAV_ORDER,
  type NavItem,
} from './nav-items';
import { MoreSheet } from './MoreSheet';
import styles from './BottomNav.module.css';

export function BottomNav({ onQuickCapture }: { onQuickCapture: () => void }) {
  const pathname = usePathname();
  const { secondNav } = useSecondNav();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);

  const closeMore = () => {
    setMoreOpen(false);
    moreButtonRef.current?.focus();
  };

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

  const overflowKeys = SECOND_NAV_ORDER.filter((k) => k !== secondNav);
  const moreActive = overflowKeys.some((k) => {
    const href = SECONDARY_NAV[k].href;
    return pathname === href || pathname.startsWith(`${href}/`);
  });

  return (
    <>
      <nav className={styles.bar} aria-label="Primary">
        {renderLink(HOME_NAV_ITEM)}
        {renderLink(SECONDARY_NAV[secondNav])}

        <button type="button" className={styles.fab} onClick={onQuickCapture} aria-label="Quick capture">
          <PlusIcon size={24} />
        </button>

        {renderLink(PROJECTS_NAV_ITEM)}

        <button
          ref={moreButtonRef}
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

      <MoreSheet open={moreOpen} onClose={closeMore} />
    </>
  );
}
```

- [ ] **Step 5: Update MoreSheet**

Replace the entire contents of `apps/web/src/components/app-shell/MoreSheet.tsx` with:

```tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@lifesync/ui';
import { useSecondNav } from '@/lib/nav-prefs';
import { SECONDARY_NAV, SECOND_NAV_ORDER } from './nav-items';
import { AccountControl } from './AccountControl';
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
  const { secondNav } = useSecondNav();
  if (!open) return null;

  const items = SECOND_NAV_ORDER.filter((k) => k !== secondNav).map((k) => SECONDARY_NAV[k]);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="More">
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        {items.map((item) => {
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
        <div className={styles.accountFooter}>
          <AccountControl />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Add the account footer style**

Append to `apps/web/src/components/app-shell/MoreSheet.module.css`:

```css
.accountFooter {
  margin-top: var(--ls-space-2);
  padding-top: var(--ls-space-3);
  border-top: 1px solid var(--ls-surface-border);
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter=web test -- BottomNav MoreSheet`
Expected: PASS (BottomNav 3 tests, MoreSheet 4 tests).

- [ ] **Step 8: Verify typecheck and commit**

Run: `pnpm --filter=web typecheck`
Expected: no errors.

```bash
git add apps/web/src/components/app-shell/nav-items.tsx apps/web/src/components/app-shell/BottomNav.tsx apps/web/src/components/app-shell/BottomNav.test.tsx apps/web/src/components/app-shell/MoreSheet.tsx apps/web/src/components/app-shell/MoreSheet.module.css apps/web/src/components/app-shell/MoreSheet.test.tsx
git commit -m "feat(web): customizable second bottom-bar button + account in More sheet"
```

---

## Task 4: Settings card

**Files:**
- Create: `apps/web/src/components/settings/NavSettings.tsx`
- Create: `apps/web/src/components/settings/NavSettings.test.tsx`
- Modify: `apps/web/src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/settings/NavSettings.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const setSecondNav = vi.fn();
vi.mock('@/lib/nav-prefs', () => ({
  useSecondNav: () => ({ secondNav: 'inbox', setSecondNav }),
}));

import { NavSettings } from './NavSettings';

describe('NavSettings', () => {
  it('changes the second nav button selection', async () => {
    render(<NavSettings />);
    await userEvent.selectOptions(screen.getByLabelText('Second button'), 'calendar');
    expect(setSecondNav).toHaveBeenCalledWith('calendar');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter=web test -- NavSettings`
Expected: FAIL — `Cannot find module './NavSettings'`.

- [ ] **Step 3: Create the component**

Create `apps/web/src/components/settings/NavSettings.tsx`:

```tsx
'use client';

import { Input } from '@lifesync/ui';
import { useSecondNav, type SecondNavKey } from '@/lib/nav-prefs';
import { SECONDARY_NAV, SECOND_NAV_ORDER } from '@/components/app-shell/nav-items';
import { SectionCard } from './SectionCard';

export function NavSettings() {
  const { secondNav, setSecondNav } = useSecondNav();
  const options = SECOND_NAV_ORDER.map((k) => ({ value: k, label: SECONDARY_NAV[k].label }));
  return (
    <SectionCard title="Bottom bar">
      <Input
        as="select"
        label="Second button"
        value={secondNav}
        onChange={(v) => setSecondNav(v as SecondNavKey)}
        options={options}
        helperText="Shown in the bottom navigation on smaller screens."
      />
    </SectionCard>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter=web test -- NavSettings`
Expected: PASS (1 test).

- [ ] **Step 5: Add it to the Settings page**

In `apps/web/src/app/(app)/settings/page.tsx`, add the import after the `AppearanceSettings` import (line 6):

```tsx
import { NavSettings } from '@/components/settings/NavSettings';
```

Then render it immediately after `<AppearanceSettings />` in the returned JSX:

```tsx
      <AppearanceSettings />
      <NavSettings />
```

- [ ] **Step 6: Verify typecheck and commit**

Run: `pnpm --filter=web typecheck`
Expected: no errors.

```bash
git add apps/web/src/components/settings/NavSettings.tsx apps/web/src/components/settings/NavSettings.test.tsx "apps/web/src/app/(app)/settings/page.tsx"
git commit -m "feat(web): Settings card to choose the second bottom-bar button"
```

---

## Task 5: Full verification

- [ ] **Step 1: Run the full web test suite**

Run: `pnpm --filter=web test`
Expected: all green, including the new `nav-prefs`, `AccountControl`, `NavSettings` tests and the updated `BottomNav`/`MoreSheet` tests.

- [ ] **Step 2: Typecheck the whole repo**

Run: `pnpm typecheck`
Expected: all packages clean.

- [ ] **Step 3: Lint the changed files**

Run:
```bash
pnpm --filter=web exec eslint "src/lib/nav-prefs.tsx" "src/components/app-shell" "src/components/settings/NavSettings.tsx" "src/app/(app)/settings/page.tsx"
```
Expected: exit 0, no errors.

- [ ] **Step 4: Manual smoke (optional, if running locally)**

Start the app (`pnpm dev --filter=web` + api). On a narrow viewport, the bottom bar shows `Home | Inbox | + | Projects | More`. Open Settings → "Bottom bar" → change "Second button" to Calendar → the bottom bar's second button becomes Calendar, and the More sheet now lists Inbox instead. Open More → the account row shows your name. On desktop, the sidebar footer shows your name next to the account button.

---

## Self-Review Notes

- **Spec coverage:** nav-prefs store + localStorage + provider mount (Task 1) ✓; customizable second slot from the 5 secondary screens (Tasks 1+3) ✓; More sheet excludes promoted screen (Task 3) ✓; account name in sidebar (Task 2) and in More sheet (Task 3) ✓; "Your account" fallback (Task 2) ✓; Settings card (Task 4) ✓; per-device/no-backend and RN-untouched non-goals respected ✓; tests for every unit (Tasks 1–4) ✓.
- **Type consistency:** `SecondNavKey` defined in Task 1 is imported as a type by `nav-items` (Task 3) and `NavSettings` (Task 4); `useSecondNav()` returns `{ secondNav, setSecondNav }` used identically everywhere; `SECONDARY_NAV`/`SECOND_NAV_ORDER`/`HOME_NAV_ITEM`/`PROJECTS_NAV_ITEM` defined in Task 3 are consumed by `BottomNav`, `MoreSheet`, and `NavSettings` with matching names; `AccountControl` (Task 2) is mocked by path `./AccountControl` in the Task 3 tests, matching its real location.
- **Test isolation:** `BottomNav`/`MoreSheet` tests mock `./AccountControl` so they don't pull Clerk/tRPC; `AccountControl` has its own test mocking `@clerk/nextjs` and `@/lib/trpc`; `NavSettings` mocks `@/lib/nav-prefs` (only a type is imported by `nav-items`, erased at runtime, so the real `SECONDARY_NAV` still drives the options).
