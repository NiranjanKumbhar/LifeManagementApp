# Household / Grocery (Slice B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/household` web screen — a two-tab (Shopping list / Inventory) shared grocery & stock module over the existing `household` tRPC router.

**Architecture:** Pure frontend slice (no API/shared-types/DB changes). One new reusable `SegmentedControl` in `@lifesync/ui`; household-specific web components (`StatusPillMenu`, `StockItemRow`, `QuickAddBar`, `HouseholdItemForm`) under `apps/web/src/components/household/`; a `category-meta.ts` data module; and the route under `apps/web/src/app/(app)/household/`. Data comes from a single `household.list` query, filtered/grouped client-side; mutations (`add`/`update`/`purchase`/`restock`) invalidate the list and surface Toasts.

**Tech Stack:** Next.js 15 App Router (client components), tRPC v11 + React Query, `@lifesync/ui` design system, Vitest + React Testing Library + `@testing-library/user-event`, CSS Modules with design tokens.

**Spec:** `docs/superpowers/specs/2026-06-13-household-slice-b-design.md`

**Key reference facts (verified against the codebase):**
- Backend is complete: `household.list({ workspaceId, status?, category? })`, `household.add`, `household.update`, `household.purchase({ id })`, `household.restock({ id })`.
- `StockStatus = 'stocked' | 'low' | 'out' | 'on_list'` (from `@lifesync/shared-types`).
- `HouseholdItem`: `name, category, status, quantity: number|null, unit: string|null, autoReplenish, lastPurchased: Date|null, sortOrder`. Dates cross the wire as ISO strings.
- `household.add` defaults `category` to `'other'` (lowercase) and `status` to `'stocked'` when omitted.
- `Badge` tones available: `'neutral' | 'primary' | 'overdue' | 'soon' | 'completed'`. Status→tone: stocked→`completed`, low→`soon`, out→`overdue`, on_list→`primary`.
- `Button` variants: `'primary' | 'secondary' | 'ghost' | 'danger'`; sizes `'sm'|'md'|'lg'`.
- `Input` API: `{ label, value, onChange:(v:string)=>void, error?, helperText?, required?, placeholder? }` plus `as?: 'input'|'textarea'|'select'`, `type?: 'text'|'number'|'date'`, `options` (for select).
- `formatShortDate(value: string|Date|null)` from `@lifesync/ui`.
- Icons in `apps/web/src/components/icons.tsx` include `BasketIcon`, `PlusIcon`, `CheckCircleIcon`.
- **There is NO `useClickOutside` hook in `@lifesync/ui`** (the spec mentioned one; it doesn't exist). `StatusPillMenu` implements outside-click locally with a `mousedown` listener (the same approach to avoid adding a package hook this slice).
- UI package tests: Vitest + jsdom, globals on; import from `vitest`, render from `@testing-library/react`. Web tests mock `@/lib/trpc` and `@/lib/hooks/useWorkspaceId` and wrap in `ToastProvider` (see `apps/web/src/app/(app)/projects/page.test.tsx`).

---

## File Structure

**New (UI package):**
- `packages/ui/src/components/SegmentedControl/SegmentedControl.tsx`
- `packages/ui/src/components/SegmentedControl/SegmentedControl.module.css`
- `packages/ui/src/components/SegmentedControl/SegmentedControl.test.tsx`
- Modify: `packages/ui/src/index.ts` (barrel export)

**New (web):**
- `apps/web/src/lib/household/category-meta.ts`
- `apps/web/src/lib/household/category-meta.test.ts`
- `apps/web/src/components/household/StatusPillMenu.tsx` + `.module.css`
- `apps/web/src/components/household/StatusPillMenu.test.tsx`
- `apps/web/src/components/household/StockItemRow.tsx` + `.module.css`
- `apps/web/src/components/household/QuickAddBar.tsx` + `.module.css`
- `apps/web/src/components/household/HouseholdItemForm.tsx` + `.module.css`
- `apps/web/src/app/(app)/household/page.tsx`
- `apps/web/src/app/(app)/household/loading.tsx`
- `apps/web/src/app/(app)/household/household.module.css`
- `apps/web/src/app/(app)/household/page.test.tsx`

**No changes** to `apps/api`, `packages/shared-types`, or the DB. The sidebar already links `/household`.

---

## Task 1: `SegmentedControl` component (`@lifesync/ui`)

**Files:**
- Create: `packages/ui/src/components/SegmentedControl/SegmentedControl.tsx`
- Create: `packages/ui/src/components/SegmentedControl/SegmentedControl.module.css`
- Test: `packages/ui/src/components/SegmentedControl/SegmentedControl.test.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/components/SegmentedControl/SegmentedControl.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from './SegmentedControl';

const options = [
  { value: 'shopping', label: 'Shopping list' },
  { value: 'inventory', label: 'Inventory' },
];

describe('SegmentedControl', () => {
  it('renders a tablist with the options', () => {
    render(<SegmentedControl options={options} value="shopping" onChange={() => {}} ariaLabel="View" />);
    expect(screen.getByRole('tablist', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Shopping list', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Inventory', selected: false })).toBeInTheDocument();
  });

  it('calls onChange when a segment is clicked', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={options} value="shopping" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Inventory' }));
    expect(onChange).toHaveBeenCalledWith('inventory');
  });

  it('moves selection with the arrow keys', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={options} value="shopping" onChange={onChange} />);
    screen.getByRole('tab', { name: 'Shopping list' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('inventory');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lifesync/ui test -- SegmentedControl`
Expected: FAIL — cannot resolve `./SegmentedControl`.

- [ ] **Step 3: Write the component**

Create `packages/ui/src/components/SegmentedControl/SegmentedControl.tsx`:

```tsx
'use client';

import { useRef, type KeyboardEvent } from 'react';
import { cn } from '../../utils/cn';
import styles from './SegmentedControl.module.css';

export interface SegmentedControlOption {
  value: string;
  label: string;
}

export interface SegmentedControlProps {
  options: SegmentedControlOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}

export function SegmentedControl({ options, value, onChange, ariaLabel }: SegmentedControlProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    const next = (index + dir + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div className={styles.root} role="tablist" aria-label={ariaLabel}>
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={cn(styles.segment, selected && styles.selected)}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
```

Create `packages/ui/src/components/SegmentedControl/SegmentedControl.module.css`:

```css
.root {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--color-surface-sunken, #efe9e1);
  border-radius: var(--radius-lg, 0.75rem);
}

.segment {
  appearance: none;
  border: none;
  background: transparent;
  padding: 0.4rem 0.9rem;
  border-radius: var(--radius-md, 0.5rem);
  font: inherit;
  font-weight: 500;
  color: var(--color-text-muted, #6b6258);
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
}

.segment:focus-visible {
  outline: 2px solid var(--color-primary, #0f766e);
  outline-offset: 2px;
}

.selected {
  background: var(--color-surface, #fff);
  color: var(--color-text, #2b2620);
  box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.08));
}

@media (prefers-reduced-motion: reduce) {
  .segment {
    transition: none;
  }
}
```

- [ ] **Step 4: Add the barrel export**

In `packages/ui/src/index.ts`, add after the `ProjectCard` export block:

```ts
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedControlOption,
} from './components/SegmentedControl/SegmentedControl';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @lifesync/ui test -- SegmentedControl`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/SegmentedControl packages/ui/src/index.ts
git commit -m "feat(ui): add SegmentedControl tab component"
```

---

## Task 2: Household category & status metadata (web)

**Files:**
- Create: `apps/web/src/lib/household/category-meta.ts`
- Test: `apps/web/src/lib/household/category-meta.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/household/category-meta.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { groupByCategory, HOUSEHOLD_STATUS_META, SHOPPING_STATUSES } from './category-meta';

type Row = { category: string; sortOrder: number; name: string };

describe('category-meta', () => {
  it('maps the four statuses to badge tones', () => {
    expect(HOUSEHOLD_STATUS_META.stocked.tone).toBe('completed');
    expect(HOUSEHOLD_STATUS_META.low.tone).toBe('soon');
    expect(HOUSEHOLD_STATUS_META.out.tone).toBe('overdue');
    expect(HOUSEHOLD_STATUS_META.on_list.tone).toBe('primary');
  });

  it('lists shopping statuses', () => {
    expect(SHOPPING_STATUSES).toEqual(['out', 'low', 'on_list']);
  });

  it('groups items by curated category order, case-insensitively, sorted by sortOrder', () => {
    const items: Row[] = [
      { category: 'Dairy', sortOrder: 1, name: 'Milk' },
      { category: 'produce', sortOrder: 2, name: 'Spinach' },
      { category: 'produce', sortOrder: 1, name: 'Bananas' },
    ];
    const groups = groupByCategory(items);
    expect(groups.map((g) => g.category)).toEqual(['Produce', 'Dairy']);
    expect(groups[0].items.map((i) => i.name)).toEqual(['Bananas', 'Spinach']);
  });

  it('places unknown categories after the curated ones under their own heading', () => {
    const items: Row[] = [
      { category: 'Garage', sortOrder: 0, name: 'Motor oil' },
      { category: 'Pantry', sortOrder: 0, name: 'Rice' },
    ];
    const groups = groupByCategory(items);
    expect(groups.map((g) => g.category)).toEqual(['Pantry', 'Garage']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- category-meta`
Expected: FAIL — cannot resolve `./category-meta`.

- [ ] **Step 3: Write the metadata module**

Create `apps/web/src/lib/household/category-meta.ts`:

```ts
import type { StockStatus } from '@lifesync/shared-types';
import type { BadgeProps } from '@lifesync/ui';

/** Curated grocery categories, in display order. Stored as plain strings. */
export const HOUSEHOLD_CATEGORY_ORDER = [
  'Produce',
  'Dairy',
  'Meat & seafood',
  'Bakery',
  'Frozen',
  'Pantry',
  'Beverages',
  'Household supplies',
  'Personal care',
  'Other',
] as const;

export const HOUSEHOLD_STATUS_META: Record<StockStatus, { label: string; tone: BadgeProps['tone'] }> = {
  stocked: { label: 'Stocked', tone: 'completed' },
  low: { label: 'Low', tone: 'soon' },
  out: { label: 'Out', tone: 'overdue' },
  on_list: { label: 'On list', tone: 'primary' },
};

/** Statuses that appear on the Shopping list tab, in priority order. */
export const SHOPPING_STATUSES: StockStatus[] = ['out', 'low', 'on_list'];

export interface CategoryGroup<T> {
  category: string;
  items: T[];
}

/**
 * Group items into curated categories (case-insensitive match), with any
 * unknown categories appended after, each sorted by `sortOrder`.
 */
export function groupByCategory<T extends { category: string; sortOrder: number }>(
  items: T[],
): CategoryGroup<T>[] {
  const curatedLower = HOUSEHOLD_CATEGORY_ORDER.map((c) => c.toLowerCase());
  const buckets = new Map<string, T[]>();

  for (const item of items) {
    const idx = curatedLower.indexOf(item.category.toLowerCase());
    const key = idx >= 0 ? HOUSEHOLD_CATEGORY_ORDER[idx] : item.category;
    const arr = buckets.get(key) ?? [];
    arr.push(item);
    buckets.set(key, arr);
  }

  const ordered: string[] = [];
  for (const c of HOUSEHOLD_CATEGORY_ORDER) if (buckets.has(c)) ordered.push(c);
  for (const k of buckets.keys()) if (!ordered.includes(k)) ordered.push(k);

  return ordered.map((category) => ({
    category,
    items: [...(buckets.get(category) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- category-meta`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/household
git commit -m "feat(web): add household category/status metadata and grouping"
```

---

## Task 3: `StatusPillMenu` component (web)

**Files:**
- Create: `apps/web/src/components/household/StatusPillMenu.tsx`
- Create: `apps/web/src/components/household/StatusPillMenu.module.css`
- Test: `apps/web/src/components/household/StatusPillMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/household/StatusPillMenu.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusPillMenu } from './StatusPillMenu';

describe('StatusPillMenu', () => {
  it('shows the current status label', () => {
    render(<StatusPillMenu status="out" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /out/i })).toBeInTheDocument();
  });

  it('opens a menu and reports the chosen status', async () => {
    const onSelect = vi.fn();
    render(<StatusPillMenu status="out" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /out/i }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Stocked' }));
    expect(onSelect).toHaveBeenCalledWith('stocked');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- StatusPillMenu`
Expected: FAIL — cannot resolve `./StatusPillMenu`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/household/StatusPillMenu.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { StockStatus } from '@lifesync/shared-types';
import { Badge } from '@lifesync/ui';
import { HOUSEHOLD_STATUS_META } from '@/lib/household/category-meta';
import styles from './StatusPillMenu.module.css';

const ALL_STATUSES: StockStatus[] = ['stocked', 'low', 'out', 'on_list'];

export interface StatusPillMenuProps {
  status: StockStatus;
  onSelect: (status: StockStatus) => void;
}

export function StatusPillMenu({ status, onSelect }: StatusPillMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const meta = HOUSEHOLD_STATUS_META[status];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Badge tone={meta.tone}>{meta.label}</Badge>
        <span aria-hidden="true" className={styles.caret}>
          ▾
        </span>
      </button>
      {open ? (
        <ul className={styles.menu} role="menu">
          {ALL_STATUSES.map((s) => (
            <li key={s} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={s === status}
                className={styles.item}
                onClick={() => {
                  onSelect(s);
                  setOpen(false);
                }}
              >
                {HOUSEHOLD_STATUS_META[s].label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

Create `apps/web/src/components/household/StatusPillMenu.module.css`:

```css
.root {
  position: relative;
  display: inline-block;
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  font: inherit;
}

.trigger:focus-visible {
  outline: 2px solid var(--color-primary, #0f766e);
  outline-offset: 2px;
  border-radius: var(--radius-sm, 0.25rem);
}

.caret {
  color: var(--color-text-muted, #6b6258);
  font-size: 0.7rem;
}

.menu {
  position: absolute;
  right: 0;
  top: calc(100% + 0.25rem);
  z-index: 20;
  margin: 0;
  padding: 0.25rem;
  list-style: none;
  min-width: 9rem;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e3dccf);
  border-radius: var(--radius-md, 0.5rem);
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0, 0, 0, 0.12));
}

.item {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 0.4rem 0.6rem;
  border-radius: var(--radius-sm, 0.25rem);
  font: inherit;
  color: var(--color-text, #2b2620);
  cursor: pointer;
}

.item:hover,
.item:focus-visible {
  background: var(--color-surface-sunken, #efe9e1);
  outline: none;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- StatusPillMenu`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/household/StatusPillMenu.tsx apps/web/src/components/household/StatusPillMenu.module.css apps/web/src/components/household/StatusPillMenu.test.tsx
git commit -m "feat(web): add household StatusPillMenu"
```

---

## Task 4: `StockItemRow` component (web)

**Files:**
- Create: `apps/web/src/components/household/StockItemRow.tsx`
- Create: `apps/web/src/components/household/StockItemRow.module.css`
- Test: `apps/web/src/components/household/StockItemRow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/household/StockItemRow.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StockItemRow } from './StockItemRow';

const item = {
  id: 'h1',
  workspaceId: 'ws-1',
  name: 'Bananas',
  category: 'Produce',
  status: 'out' as const,
  quantity: 2,
  unit: 'bunch',
  autoReplenish: false,
  lastPurchased: null,
  addedBy: null,
  sortOrder: 0,
  createdAt: '2026-06-01',
  updatedAt: '2026-06-01',
};

describe('StockItemRow', () => {
  it('shows the "Got it" action on the shopping tab and fires onPrimary', async () => {
    const onPrimary = vi.fn();
    render(
      <StockItemRow item={item} tab="shopping" onPrimary={onPrimary} onSetStatus={() => {}} onEdit={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onPrimary).toHaveBeenCalledWith('h1');
  });

  it('shows the "Need more" action on the inventory tab and fires onPrimary', async () => {
    const onPrimary = vi.fn();
    render(
      <StockItemRow item={item} tab="inventory" onPrimary={onPrimary} onSetStatus={() => {}} onEdit={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Need more' }));
    expect(onPrimary).toHaveBeenCalledWith('h1');
  });

  it('opens the editor when the name is clicked', async () => {
    const onEdit = vi.fn();
    render(
      <StockItemRow item={item} tab="shopping" onPrimary={() => {}} onSetStatus={() => {}} onEdit={onEdit} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Bananas/ }));
    expect(onEdit).toHaveBeenCalledWith(item);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- StockItemRow`
Expected: FAIL — cannot resolve `./StockItemRow`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/household/StockItemRow.tsx`:

```tsx
'use client';

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import type { StockStatus } from '@lifesync/shared-types';
import { Button, formatShortDate } from '@lifesync/ui';
import { StatusPillMenu } from './StatusPillMenu';
import styles from './StockItemRow.module.css';

export type HouseholdItemRow = inferRouterOutputs<AppRouter>['household']['list'][number];

export interface StockItemRowProps {
  item: HouseholdItemRow;
  tab: 'shopping' | 'inventory';
  onPrimary: (id: string) => void;
  onSetStatus: (id: string, status: StockStatus) => void;
  onEdit: (item: HouseholdItemRow) => void;
}

export function StockItemRow({ item, tab, onPrimary, onSetStatus, onEdit }: StockItemRowProps) {
  const measure = [item.quantity != null ? String(item.quantity) : null, item.unit]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.row}>
      <button type="button" className={styles.main} onClick={() => onEdit(item)}>
        <span className={styles.name}>{item.name}</span>
        {measure ? <span className={styles.meta}>{measure}</span> : null}
        {tab === 'inventory' && item.lastPurchased ? (
          <span className={styles.meta}>Last bought {formatShortDate(item.lastPurchased)}</span>
        ) : null}
      </button>
      <div className={styles.controls}>
        <StatusPillMenu status={item.status} onSelect={(s) => onSetStatus(item.id, s)} />
        <Button
          size="sm"
          variant={tab === 'shopping' ? 'primary' : 'ghost'}
          onClick={() => onPrimary(item.id)}
        >
          {tab === 'shopping' ? 'Got it' : 'Need more'}
        </Button>
      </div>
    </div>
  );
}
```

Create `apps/web/src/components/household/StockItemRow.module.css`:

```css
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-md, 0.5rem);
}

.row:hover {
  background: var(--color-surface-sunken, #efe9e1);
}

.main {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  flex: 1 1 auto;
  min-width: 0;
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;
  font: inherit;
  cursor: pointer;
}

.name {
  font-weight: 500;
  color: var(--color-text, #2b2620);
}

.meta {
  font-size: 0.8rem;
  color: var(--color-text-muted, #6b6258);
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: 0 0 auto;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- StockItemRow`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/household/StockItemRow.tsx apps/web/src/components/household/StockItemRow.module.css apps/web/src/components/household/StockItemRow.test.tsx
git commit -m "feat(web): add household StockItemRow"
```

---

## Task 5: `QuickAddBar` component (web)

**Files:**
- Create: `apps/web/src/components/household/QuickAddBar.tsx`
- Create: `apps/web/src/components/household/QuickAddBar.module.css`
- Test: `apps/web/src/components/household/QuickAddBar.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/household/QuickAddBar.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickAddBar } from './QuickAddBar';

describe('QuickAddBar', () => {
  it('submits the trimmed name on Enter and clears the field', async () => {
    const onAdd = vi.fn();
    render(<QuickAddBar onAdd={onAdd} />);
    const input = screen.getByRole('textbox', { name: /add item/i });
    await userEvent.type(input, '  Milk  {Enter}');
    expect(onAdd).toHaveBeenCalledWith('Milk');
    expect(input).toHaveValue('');
  });

  it('does not submit an empty name', async () => {
    const onAdd = vi.fn();
    render(<QuickAddBar onAdd={onAdd} />);
    await userEvent.type(screen.getByRole('textbox', { name: /add item/i }), '   {Enter}');
    expect(onAdd).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- QuickAddBar`
Expected: FAIL — cannot resolve `./QuickAddBar`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/household/QuickAddBar.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import { PlusIcon } from '@/components/icons';
import styles from './QuickAddBar.module.css';

export interface QuickAddBarProps {
  onAdd: (name: string) => void;
  placeholder?: string;
}

export function QuickAddBar({ onAdd, placeholder = 'Add item…' }: QuickAddBarProps) {
  const [name, setName] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName('');
  };

  return (
    <form className={styles.bar} onSubmit={submit}>
      <span className={styles.icon} aria-hidden="true">
        <PlusIcon size={18} />
      </span>
      <input
        className={styles.input}
        type="text"
        aria-label="Add item"
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
    </form>
  );
}
```

Create `apps/web/src/components/household/QuickAddBar.module.css`:

```css
.bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #e3dccf);
  border-radius: var(--radius-md, 0.5rem);
}

.bar:focus-within {
  border-color: var(--color-primary, #0f766e);
}

.icon {
  display: inline-flex;
  color: var(--color-text-muted, #6b6258);
}

.input {
  flex: 1 1 auto;
  border: none;
  background: transparent;
  font: inherit;
  color: var(--color-text, #2b2620);
}

.input:focus {
  outline: none;
}
```

> Note: `PlusIcon` accepts a `size` prop (see its usage in the Projects page header).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- QuickAddBar`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/household/QuickAddBar.tsx apps/web/src/components/household/QuickAddBar.module.css apps/web/src/components/household/QuickAddBar.test.tsx
git commit -m "feat(web): add household QuickAddBar"
```

---

## Task 6: `HouseholdItemForm` component (web)

**Files:**
- Create: `apps/web/src/components/household/HouseholdItemForm.tsx`
- Create: `apps/web/src/components/household/HouseholdItemForm.module.css`
- Test: `apps/web/src/components/household/HouseholdItemForm.test.tsx`

The form edits an existing item (the `Modal` wrapper opens when a row is tapped). It mirrors `ProjectForm`: controlled local state, `Input` controls, submit calls `household.update` and invalidates `household.list`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/household/HouseholdItemForm.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const mutate = vi.fn();
vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ household: { list: { invalidate: vi.fn() } } }),
    household: { update: { useMutation: () => ({ mutate, isPending: false }) } },
  },
}));

import { HouseholdItemForm } from './HouseholdItemForm';

const item = {
  id: 'h1',
  workspaceId: 'ws-1',
  name: 'Bananas',
  category: 'Produce',
  status: 'out' as const,
  quantity: 2,
  unit: 'bunch',
  autoReplenish: false,
  lastPurchased: null,
  addedBy: null,
  sortOrder: 0,
  createdAt: '2026-06-01',
  updatedAt: '2026-06-01',
};

describe('HouseholdItemForm', () => {
  it('submits an update with the edited name', async () => {
    render(
      <ToastProvider>
        <HouseholdItemForm isOpen item={item} onClose={() => {}} />
      </ToastProvider>,
    );
    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Plantains');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ id: 'h1', name: 'Plantains' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- HouseholdItemForm`
Expected: FAIL — cannot resolve `./HouseholdItemForm`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/household/HouseholdItemForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { StockStatus } from '@lifesync/shared-types';
import { Button, Input, Modal, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { HOUSEHOLD_CATEGORY_ORDER, HOUSEHOLD_STATUS_META } from '@/lib/household/category-meta';
import type { HouseholdItemRow } from './StockItemRow';
import styles from './HouseholdItemForm.module.css';

export interface HouseholdItemFormProps {
  isOpen: boolean;
  item: HouseholdItemRow | null;
  onClose: () => void;
}

const STATUS_OPTIONS = (Object.keys(HOUSEHOLD_STATUS_META) as StockStatus[]).map((s) => ({
  value: s,
  label: HOUSEHOLD_STATUS_META[s].label,
}));

const CATEGORY_OPTIONS = HOUSEHOLD_CATEGORY_ORDER.map((c) => ({ value: c, label: c }));

export function HouseholdItemForm({ isOpen, item, onClose }: HouseholdItemFormProps) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? 'Other');
  const [status, setStatus] = useState<StockStatus>(item?.status ?? 'stocked');
  const [quantity, setQuantity] = useState(item?.quantity != null ? String(item.quantity) : '');
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [autoReplenish, setAutoReplenish] = useState(item?.autoReplenish ? 'true' : 'false');

  const update = trpc.household.update.useMutation({
    onSuccess: () => {
      if (workspaceId) void utils.household.list.invalidate({ workspaceId });
      toast.success('Item updated');
      onClose();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const submit = () => {
    if (!item || !name.trim() || update.isPending) return;
    update.mutate({
      id: item.id,
      name: name.trim(),
      category,
      status,
      quantity: quantity === '' ? null : Number(quantity),
      unit: unit.trim() === '' ? null : unit.trim(),
      autoReplenish: autoReplenish === 'true',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit item"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Input label="Name" value={name} onChange={setName} required />
        <Input as="select" label="Category" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        <Input
          as="select"
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StockStatus)}
          options={STATUS_OPTIONS}
        />
        <Input type="number" label="Quantity" value={quantity} onChange={setQuantity} />
        <Input label="Unit" value={unit} onChange={setUnit} placeholder="e.g. bunch, litre" />
        <Input
          as="select"
          label="Auto-replenish"
          value={autoReplenish}
          onChange={setAutoReplenish}
          options={[
            { value: 'false', label: 'No' },
            { value: 'true', label: 'Yes' },
          ]}
        />
      </div>
    </Modal>
  );
}
```

Create `apps/web/src/components/household/HouseholdItemForm.module.css`:

```css
.form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- HouseholdItemForm`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/household/HouseholdItemForm.tsx apps/web/src/components/household/HouseholdItemForm.module.css apps/web/src/components/household/HouseholdItemForm.test.tsx
git commit -m "feat(web): add household item edit form"
```

---

## Task 7: `/household` page, loading, and tests

**Files:**
- Create: `apps/web/src/app/(app)/household/page.tsx`
- Create: `apps/web/src/app/(app)/household/loading.tsx`
- Create: `apps/web/src/app/(app)/household/household.module.css`
- Test: `apps/web/src/app/(app)/household/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/(app)/household/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const purchaseMutate = vi.fn();
const addMutate = vi.fn();

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => {
  const item = (over: Record<string, unknown>) => ({
    id: 'x',
    workspaceId: 'ws-1',
    name: 'Item',
    category: 'Other',
    status: 'stocked',
    quantity: null,
    unit: null,
    autoReplenish: false,
    lastPurchased: null,
    addedBy: null,
    sortOrder: 0,
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
    ...over,
  });
  return {
    trpc: {
      useUtils: () => ({ household: { list: { invalidate: vi.fn() } } }),
      household: {
        list: {
          useQuery: () => ({
            isLoading: false,
            isError: false,
            data: [
              item({ id: 'b', name: 'Bananas', category: 'Produce', status: 'out' }),
              item({ id: 'm', name: 'Milk', category: 'Dairy', status: 'stocked' }),
              item({ id: 's', name: 'Spinach', category: 'Produce', status: 'low' }),
            ],
          }),
        },
        add: { useMutation: () => ({ mutate: addMutate, isPending: false }) },
        update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        purchase: { useMutation: () => ({ mutate: purchaseMutate, isPending: false }) },
        restock: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      },
    },
  };
});

import HouseholdPage from './page';

function renderPage() {
  return render(
    <ToastProvider>
      <HouseholdPage />
    </ToastProvider>,
  );
}

describe('HouseholdPage', () => {
  it('shows only shopping-list items (out/low/on_list) grouped by category by default', () => {
    renderPage();
    expect(screen.getByText('Bananas')).toBeInTheDocument();
    expect(screen.getByText('Spinach')).toBeInTheDocument();
    expect(screen.queryByText('Milk')).not.toBeInTheDocument(); // stocked → inventory only
    expect(screen.getByRole('heading', { name: /Produce/ })).toBeInTheDocument();
  });

  it('fires the purchase mutation when "Got it" is clicked', async () => {
    renderPage();
    const bananas = screen.getByText('Bananas').closest('div');
    await userEvent.click(within(bananas as HTMLElement).getByRole('button', { name: 'Got it' }));
    expect(purchaseMutate).toHaveBeenCalledWith({ id: 'b' });
  });

  it('quick-adds a shopping item with the on_list default status', async () => {
    renderPage();
    await userEvent.type(screen.getByRole('textbox', { name: /add item/i }), 'Eggs{Enter}');
    expect(addMutate).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', name: 'Eggs', status: 'on_list' }),
    );
  });

  it('switches to the Inventory tab and shows stocked items', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Inventory' }));
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Bananas')).toBeInTheDocument(); // inventory shows all
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- household/page`
Expected: FAIL — cannot resolve `./page`.

- [ ] **Step 3: Write the page**

Create `apps/web/src/app/(app)/household/page.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import type { StockStatus } from '@lifesync/shared-types';
import { EmptyState, LoadingSpinner, SegmentedControl, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { BasketIcon } from '@/components/icons';
import { QuickAddBar } from '@/components/household/QuickAddBar';
import { StockItemRow, type HouseholdItemRow } from '@/components/household/StockItemRow';
import { HouseholdItemForm } from '@/components/household/HouseholdItemForm';
import { groupByCategory, SHOPPING_STATUSES } from '@/lib/household/category-meta';
import styles from './household.module.css';

type Tab = 'shopping' | 'inventory';

export default function HouseholdPage() {
  const workspaceId = useWorkspaceId();
  const enabled = Boolean(workspaceId);
  const toast = useToast();
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<Tab>('shopping');
  const [editing, setEditing] = useState<HouseholdItemRow | null>(null);

  const query = trpc.household.list.useQuery({ workspaceId: workspaceId ?? '' }, { enabled });

  const invalidate = () => {
    if (workspaceId) void utils.household.list.invalidate({ workspaceId });
  };
  const onError = (e: { message: string }) => toast.error(e.message);

  const add = trpc.household.add.useMutation({ onSuccess: invalidate, onError });
  const purchase = trpc.household.purchase.useMutation({ onSuccess: invalidate, onError });
  const restock = trpc.household.restock.useMutation({ onSuccess: invalidate, onError });
  const update = trpc.household.update.useMutation({ onSuccess: invalidate, onError });

  const items = query.data ?? [];
  const visible = useMemo(
    () => (tab === 'shopping' ? items.filter((i) => SHOPPING_STATUSES.includes(i.status)) : items),
    [items, tab],
  );
  const groups = useMemo(() => groupByCategory(visible), [visible]);

  const onAdd = (name: string) => {
    if (!workspaceId) return;
    add.mutate({ workspaceId, name, status: tab === 'shopping' ? 'on_list' : 'stocked' });
  };
  const onPrimary = (id: string) =>
    tab === 'shopping' ? purchase.mutate({ id }) : restock.mutate({ id });
  const onSetStatus = (id: string, status: StockStatus) => update.mutate({ id, status });

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.heading}>Household</h1>
          <p className={styles.subhead}>Groceries and supplies, shared and up to date.</p>
        </div>
        <SegmentedControl
          ariaLabel="Household view"
          value={tab}
          onChange={(v) => setTab(v as Tab)}
          options={[
            { value: 'shopping', label: 'Shopping list' },
            { value: 'inventory', label: 'Inventory' },
          ]}
        />
      </header>

      <div className={styles.addbar}>
        <QuickAddBar
          onAdd={onAdd}
          placeholder={tab === 'shopping' ? 'Add to shopping list…' : 'Add to inventory…'}
        />
      </div>

      {query.isLoading ? (
        <div className={styles.center}>
          <LoadingSpinner size="lg" label="Loading your household" />
        </div>
      ) : query.isError || !query.data ? (
        <div className={styles.center}>
          <EmptyState
            title="We couldn't load your household"
            description={
              workspaceId ? 'Make sure the API is running.' : 'No workspace is configured yet.'
            }
          />
        </div>
      ) : items.length === 0 ? (
        <div className={styles.center}>
          <EmptyState
            title="Nothing tracked yet"
            description="Add your first item with the bar above."
          />
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.center}>
          <EmptyState title="All stocked up 🎉" description="Nothing on the shopping list right now." />
        </div>
      ) : (
        <div className={styles.groups}>
          {groups.map((group) => (
            <section key={group.category} className={styles.group}>
              <h2 className={styles.groupHead}>
                <span className={styles.groupIcon} aria-hidden="true">
                  <BasketIcon size={16} />
                </span>
                {group.category}
                <span className={styles.groupCount}>{group.items.length}</span>
              </h2>
              <div className={styles.list}>
                {group.items.map((item) => (
                  <StockItemRow
                    key={item.id}
                    item={item}
                    tab={tab}
                    onPrimary={onPrimary}
                    onSetStatus={onSetStatus}
                    onEdit={setEditing}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {editing ? (
        <HouseholdItemForm isOpen item={editing} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
```

> Note: `BasketIcon` accepts a `size` prop like the other icons. If TypeScript reports otherwise, drop the `size` prop (icons default to a sensible size).

Create `apps/web/src/app/(app)/household/loading.tsx`:

```tsx
import { LoadingSpinner } from '@lifesync/ui';

export default function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
      <LoadingSpinner size="lg" label="Loading your household" />
    </div>
  );
}
```

Create `apps/web/src/app/(app)/household/household.module.css`:

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  max-width: 56rem;
  margin: 0 auto;
  width: 100%;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.heading {
  font-family: var(--font-display, 'Fraunces', serif);
  font-size: 1.6rem;
  margin: 0;
  color: var(--color-text, #2b2620);
}

.subhead {
  margin: 0.25rem 0 0;
  color: var(--color-text-muted, #6b6258);
}

.addbar {
  width: 100%;
}

.center {
  display: flex;
  justify-content: center;
  padding: 3rem 0;
}

.groups {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.groupHead {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-muted, #6b6258);
  margin: 0;
}

.groupIcon {
  display: inline-flex;
  color: var(--color-primary, #0f766e);
}

.groupCount {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-muted, #6b6258);
  background: var(--color-surface-sunken, #efe9e1);
  border-radius: 999px;
  padding: 0.05rem 0.5rem;
}

.list {
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web test -- household/page`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/household"
git commit -m "feat(web): add /household shopping list + inventory screen"
```

---

## Task 8: Full verification

- [ ] **Step 1: Type-check, lint, and run the full suite**

Run:
```bash
pnpm --filter @lifesync/ui build
pnpm typecheck
pnpm lint
pnpm test
```
Expected: typecheck clean, lint clean, all tests pass. The web suite gains the household component + page tests (≈ 12 new); the ui suite gains SegmentedControl (3). Update the count in `CLAUDE.md` if the project tracks a total.

> The `@lifesync/ui build` step ensures the new `SegmentedControl` export is compiled so `apps/web` resolves it (other packages consume the built output).

- [ ] **Step 2: Manual smoke (optional but recommended)**

Run `pnpm dev --filter=web` (and `--filter=api`), open `http://localhost:3000/household`:
- Quick-add an item → appears on the shopping list.
- Click "Got it" → item leaves the shopping list (now stocked); switch to Inventory to see it with a "Stocked" pill.
- On Inventory, click "Need more" → item returns to the shopping list.
- Tap a row → edit modal opens; change unit/quantity → saves.
- Open the status pill menu → set "Low" → pill updates.

- [ ] **Step 3: Update docs & memory**

- In `CLAUDE.md` "Done ✅" Web bullet, add the Household screen and `SegmentedControl` to the component list; in "Remaining 🔭" item 1, mark Household done (People/Calendar/Settings remain).
- Update the `web-screens-slice-plan` memory: mark Slice B done with the commit hash.

- [ ] **Step 4: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Household (Slice B) complete in status"
```

---

## Self-Review Notes (verified against the spec)

- **§3 two tabs / filtering / grouping** → Task 7 (`SHOPPING_STATUSES` filter, `groupByCategory`).
- **§3.1 quick-add `on_list` default / Got it → purchase** → Task 7 `onAdd`, `onPrimary`.
- **§3.2 inventory all items / Need more → restock / last bought** → Task 7 + Task 4 (`StockItemRow` lastPurchased).
- **§4.1 SegmentedControl in `@lifesync/ui`** → Task 1.
- **§4.2 StatusPillMenu / StockItemRow / QuickAddBar / HouseholdItemForm** → Tasks 3–6.
- **§4.3 category-meta + status→tone mapping** → Task 2.
- **§5 single query, mutations invalidate `household.list`, Toasts** → Task 7 (`invalidate`, `onError`).
- **§6 loading / query-error / empty / "All stocked up" states** → Task 7 page branches + Task 7 `loading.tsx`.
- **§7 testing (SegmentedControl; shopping filter; Got it→purchase; quick-add status; status menu→update)** → Tasks 1, 3, 7. (Status-menu→update is covered by StatusPillMenu's onSelect test in Task 3 plus the page wiring `onSetStatus` in Task 7.)
- **Spec deviation:** the spec referenced a `useClickOutside` hook in `@lifesync/ui`; it does not exist, so `StatusPillMenu` (Task 3) implements outside-click locally. No new package hook added this slice.
