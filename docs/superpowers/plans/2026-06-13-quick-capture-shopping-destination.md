# Quick Capture → Shopping List Destination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sticky Inbox | Shopping list destination toggle to the home-screen Quick Capture sheet, so a capture can go straight to the Household shopping list (`household.add`) instead of only the Inbox.

**Architecture:** Pure frontend. The change lives in `QuickCapture.tsx` plus one small `useStickyDestination` hook; it reuses the existing `inbox.capture` and `household.add` tRPC procedures and the `SegmentedControl` from Slice B. A token-correctness fix to `SegmentedControl`'s CSS is included because it now appears in the prominent capture sheet.

**Tech Stack:** Next.js 15 (client component), tRPC v11 + React Query, `@lifesync/ui`, Vitest + React Testing Library + `@testing-library/user-event`, CSS Modules with `--ls-*` design tokens.

**Spec:** `docs/superpowers/specs/2026-06-13-quick-capture-shopping-destination-design.md`

**Key reference facts (verified against the codebase):**
- `QuickCapture.tsx` is at `apps/web/src/components/app-shell/QuickCapture.tsx`. It currently: holds `text` state, a `trpc.inbox.capture` mutation (onSuccess → invalidate `inbox.list`, clear text, `onClose()`), focuses the input on open, closes on Esc/overlay click, and renders a single text input + a `Button` labelled `Add`.
- The input's **`aria-label` is `"What's on your mind?"`** and the existing tests query by it — KEEP this aria-label constant; only the **placeholder** changes by destination.
- `household.add` input: `{ workspaceId, name, status?, category?, quantity?, unit?, autoReplenish? }`. We send `{ workspaceId, name, status: 'on_list' }`; the service defaults `category` to `'other'`. `StockStatus` includes `'on_list'`.
- `SegmentedControl` (from `@lifesync/ui`) props: `{ options: {value,label}[], value, onChange:(v)=>void, ariaLabel? }`; renders `role="tablist"` with `role="tab"` buttons.
- The app's design tokens are `--ls-*` (see `apps/web/src/styles/variables.css`). Other `@lifesync/ui` components (Badge, Button) use bare `var(--ls-...)`. The `SegmentedControl` CSS mistakenly uses `--color-*` names with hardcoded fallbacks — Task 1 corrects this.
- Token map needed: `--color-surface-sunken`→`--ls-surface-sunken`, `--color-surface`→`--ls-surface-elevated`, `--color-text`→`--ls-text-primary`, `--color-text-muted`→`--ls-text-secondary`, `--color-primary`→`--ls-primary-600`, `--radius-lg`→`--ls-radius-lg`, `--radius-md`→`--ls-radius-md`, `--shadow-sm`→`--ls-shadow-sm`.
- QuickCapture's CSS uses `--ls-*` tokens already (e.g. `--ls-space-4`, `--ls-text-xs`, `--ls-urgency-overdue`, `--ls-urgency-on-track`).
- The existing QuickCapture test mocks `@/lib/hooks/useWorkspaceId` and `@/lib/trpc` and uses the `vi.hoisted` pattern; the mutation mock calls `opts.onSuccess?.()` synchronously inside `mutate`.

---

## File Structure

**Modified (UI package):**
- `packages/ui/src/components/SegmentedControl/SegmentedControl.module.css` — token names corrected to `--ls-*` (Task 1).

**New (web):**
- `apps/web/src/lib/hooks/useStickyDestination.ts` + `useStickyDestination.test.ts` (Task 2).

**Modified (web):**
- `apps/web/src/components/app-shell/QuickCapture.tsx` (Task 3)
- `apps/web/src/components/app-shell/QuickCapture.module.css` (Task 3)
- `apps/web/src/components/app-shell/QuickCapture.test.tsx` (Task 3)
- `CLAUDE.md` (Task 4)

**No changes** to `apps/api`, `packages/shared-types`, or the DB.

> **Known follow-up (NOT in this slice):** the household-local components from Slice B (`StatusPillMenu`, `StockItemRow`, `QuickAddBar`, `HouseholdItemForm`, `household.module.css`) also use `--color-*` token names with fallbacks. They render acceptably via fallbacks and are not touched by this feature, so correcting them is deferred to a separate cleanup to keep this slice focused.

---

## Task 1: Correct `SegmentedControl` CSS tokens to `--ls-*`

**Files:**
- Modify: `packages/ui/src/components/SegmentedControl/SegmentedControl.module.css`

CSS-only change so the toggle renders on-theme inside the Quick Capture sheet. No behavior change; the existing `SegmentedControl` tests assert roles/callbacks (not colors) and keep passing.

- [ ] **Step 1: Replace the stylesheet contents**

Overwrite `packages/ui/src/components/SegmentedControl/SegmentedControl.module.css` with:

```css
.root {
  display: inline-flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background: var(--ls-surface-sunken);
  border-radius: var(--ls-radius-lg);
}

.segment {
  appearance: none;
  border: none;
  background: transparent;
  padding: 0.4rem 0.9rem;
  border-radius: var(--ls-radius-md);
  font: inherit;
  font-weight: 500;
  color: var(--ls-text-secondary);
  cursor: pointer;
  transition: background 150ms ease, color 150ms ease;
}

.segment:focus-visible {
  outline: 2px solid var(--ls-primary-600);
  outline-offset: 2px;
}

.selected {
  background: var(--ls-surface-elevated);
  color: var(--ls-text-primary);
  box-shadow: var(--ls-shadow-sm);
}

@media (prefers-reduced-motion: reduce) {
  .segment {
    transition: none;
  }
}
```

- [ ] **Step 2: Verify the SegmentedControl tests still pass**

Run: `pnpm --filter @lifesync/ui test -- SegmentedControl`
Expected: PASS (3 tests) — unchanged behavior.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/SegmentedControl/SegmentedControl.module.css
git commit -m "style(ui): use --ls-* design tokens in SegmentedControl"
```

---

## Task 2: `useStickyDestination` hook

**Files:**
- Create: `apps/web/src/lib/hooks/useStickyDestination.ts`
- Test: `apps/web/src/lib/hooks/useStickyDestination.test.ts`

A localStorage-backed, SSR-safe hook returning `[destination, setDestination]` where destination is `'inbox' | 'shopping'`. Default `'inbox'`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/hooks/useStickyDestination.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useStickyDestination, CAPTURE_DESTINATION_KEY } from './useStickyDestination';

describe('useStickyDestination', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('defaults to inbox when nothing is stored', () => {
    const { result } = renderHook(() => useStickyDestination());
    expect(result.current[0]).toBe('inbox');
  });

  it('persists the chosen destination and re-reads it on a fresh mount', () => {
    const first = renderHook(() => useStickyDestination());
    act(() => {
      first.result.current[1]('shopping');
    });
    expect(first.result.current[0]).toBe('shopping');
    expect(window.localStorage.getItem(CAPTURE_DESTINATION_KEY)).toBe('shopping');

    const second = renderHook(() => useStickyDestination());
    expect(second.result.current[0]).toBe('shopping');
  });

  it('ignores an invalid stored value and falls back to inbox', () => {
    window.localStorage.setItem(CAPTURE_DESTINATION_KEY, 'garbage');
    const { result } = renderHook(() => useStickyDestination());
    expect(result.current[0]).toBe('inbox');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- useStickyDestination`
Expected: FAIL — cannot resolve `./useStickyDestination`.

- [ ] **Step 3: Write the hook**

Create `apps/web/src/lib/hooks/useStickyDestination.ts`:

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';

export type CaptureDestination = 'inbox' | 'shopping';

export const CAPTURE_DESTINATION_KEY = 'lifesync.capture.destination';

function isDestination(value: string | null): value is CaptureDestination {
  return value === 'inbox' || value === 'shopping';
}

/**
 * The Quick Capture destination, remembered across sessions in localStorage.
 * SSR-safe: starts at 'inbox' and adopts the stored value after mount.
 */
export function useStickyDestination(): [CaptureDestination, (next: CaptureDestination) => void] {
  const [destination, setDestination] = useState<CaptureDestination>('inbox');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(CAPTURE_DESTINATION_KEY);
    if (isDestination(stored)) setDestination(stored);
  }, []);

  const set = useCallback((next: CaptureDestination) => {
    setDestination(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CAPTURE_DESTINATION_KEY, next);
    }
  }, []);

  return [destination, set];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- useStickyDestination`
Expected: PASS (3 tests).

> If `renderHook` is not exported from `@testing-library/react` in this repo's version, STOP and report it — do not silently switch testing approaches. (It is exported in @testing-library/react v13.1+.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/hooks/useStickyDestination.ts apps/web/src/lib/hooks/useStickyDestination.test.ts
git commit -m "feat(web): add useStickyDestination hook for Quick Capture"
```

---

## Task 3: QuickCapture destination toggle + routing

**Files:**
- Modify: `apps/web/src/components/app-shell/QuickCapture.tsx`
- Modify: `apps/web/src/components/app-shell/QuickCapture.module.css`
- Test: `apps/web/src/components/app-shell/QuickCapture.test.tsx`

- [ ] **Step 1: Update the test file (write the new expectations first)**

Overwrite `apps/web/src/components/app-shell/QuickCapture.test.tsx` with:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { captureMutate, addMutate } = vi.hoisted(() => ({
  captureMutate: vi.fn(),
  addMutate: vi.fn(),
}));

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      inbox: { list: { invalidate: vi.fn() } },
      household: { list: { invalidate: vi.fn() } },
    }),
    inbox: {
      capture: {
        useMutation: (opts: { onSuccess?: () => void }) => ({
          mutate: (vars: unknown) => {
            captureMutate(vars);
            opts?.onSuccess?.();
          },
          isPending: false,
          isError: false,
        }),
      },
    },
    household: {
      add: {
        useMutation: (opts: { onSuccess?: () => void }) => ({
          mutate: (vars: unknown) => {
            addMutate(vars);
            opts?.onSuccess?.();
          },
          isPending: false,
          isError: false,
        }),
      },
    },
  },
}));

import { QuickCapture } from './QuickCapture';

beforeEach(() => {
  window.localStorage.clear();
  captureMutate.mockClear();
  addMutate.mockClear();
});

describe('QuickCapture', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<QuickCapture open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('focuses the input when opened', () => {
    render(<QuickCapture open onClose={() => {}} />);
    expect(screen.getByLabelText("What's on your mind?")).toHaveFocus();
  });

  it('defaults to Inbox: captures the note and closes', async () => {
    const onClose = vi.fn();
    render(<QuickCapture open onClose={onClose} />);
    await userEvent.type(screen.getByLabelText("What's on your mind?"), 'Buy milk{Enter}');
    expect(captureMutate).toHaveBeenCalledWith({ workspaceId: 'ws-1', content: 'Buy milk' });
    expect(addMutate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('routes to the shopping list, stays open, and clears the input', async () => {
    const onClose = vi.fn();
    render(<QuickCapture open onClose={onClose} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Shopping list' }));
    const input = screen.getByLabelText("What's on your mind?");
    await userEvent.type(input, 'milk{Enter}');
    expect(addMutate).toHaveBeenCalledWith({ workspaceId: 'ws-1', name: 'milk', status: 'on_list' });
    expect(captureMutate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
  });

  it('supports burst add of multiple shopping items', async () => {
    render(<QuickCapture open onClose={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Shopping list' }));
    const input = screen.getByLabelText("What's on your mind?");
    await userEvent.type(input, 'milk{Enter}');
    await userEvent.type(input, 'eggs{Enter}');
    expect(addMutate).toHaveBeenCalledTimes(2);
    expect(addMutate).toHaveBeenLastCalledWith({ workspaceId: 'ws-1', name: 'eggs', status: 'on_list' });
  });

  it('shows the shopping placeholder when the destination is Shopping list', async () => {
    render(<QuickCapture open onClose={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Shopping list' }));
    expect(screen.getByPlaceholderText('Add to shopping list…')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web test -- QuickCapture`
Expected: FAIL — the new tests fail (no `Shopping list` tab, no `household.add` call, etc.).

- [ ] **Step 3: Rewrite the component**

Overwrite `apps/web/src/components/app-shell/QuickCapture.tsx` with:

```tsx
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, SegmentedControl } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { useStickyDestination } from '@/lib/hooks/useStickyDestination';
import styles from './QuickCapture.module.css';

export interface QuickCaptureProps {
  open: boolean;
  onClose: () => void;
}

const INBOX_PLACEHOLDER = 'Capture anything — a task, a reminder, an idea…';
const SHOPPING_PLACEHOLDER = 'Add to shopping list…';

export function QuickCapture({ open, onClose }: QuickCaptureProps) {
  const [text, setText] = useState('');
  const [justAdded, setJustAdded] = useState(false);
  const [destination, setDestination] = useStickyDestination();
  const inputRef = useRef<HTMLInputElement>(null);
  const workspaceId = useWorkspaceId();
  const utils = trpc.useUtils();

  const capture = trpc.inbox.capture.useMutation({
    onSuccess: () => {
      if (workspaceId) void utils.inbox.list.invalidate({ workspaceId });
      setText('');
      onClose();
    },
  });

  const add = trpc.household.add.useMutation({
    onSuccess: () => {
      if (workspaceId) void utils.household.list.invalidate({ workspaceId });
      setText('');
      setJustAdded(true);
      inputRef.current?.focus();
    },
  });

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const isShopping = destination === 'shopping';
  const busy = capture.isPending || add.isPending;
  const isError = capture.isError || add.isError;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || !workspaceId || busy) return;
    if (isShopping) {
      add.mutate({ workspaceId, name: value, status: 'on_list' });
    } else {
      capture.mutate({ workspaceId, content: value });
    }
  };

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Quick capture"
    >
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.toggle}>
          <SegmentedControl
            ariaLabel="Capture destination"
            value={destination}
            onChange={(v) => {
              setDestination(v as 'inbox' | 'shopping');
              setJustAdded(false);
            }}
            options={[
              { value: 'inbox', label: 'Inbox' },
              { value: 'shopping', label: 'Shopping list' },
            ]}
          />
        </div>
        <form onSubmit={submit}>
          <input
            ref={inputRef}
            className={styles.input}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (justAdded) setJustAdded(false);
            }}
            placeholder={isShopping ? SHOPPING_PLACEHOLDER : INBOX_PLACEHOLDER}
            aria-label="What's on your mind?"
            autoComplete="off"
          />
          <div className={styles.row}>
            <span className={styles.hint}>
              {isError ? (
                <span className={styles.error}>Couldn&rsquo;t save — try again.</span>
              ) : justAdded && isShopping ? (
                <span className={styles.added}>✓ Added to shopping list</span>
              ) : isShopping ? (
                'Enter to add · Esc to close'
              ) : (
                'Press Enter to save · Esc to close'
              )}
            </span>
            <Button type="submit" size="sm" disabled={!text.trim() || busy}>
              {busy ? 'Saving…' : isShopping ? 'Add to list' : 'Add'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add styles for the toggle row, accent, and confirmation**

In `apps/web/src/components/app-shell/QuickCapture.module.css`, add these rules (append after the `.error` rule):

```css
.toggle {
  display: flex;
  margin-bottom: var(--ls-space-3);
}

.added {
  color: var(--ls-urgency-on-track);
  font-weight: 600;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter web test -- QuickCapture`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/app-shell/QuickCapture.tsx apps/web/src/components/app-shell/QuickCapture.module.css apps/web/src/components/app-shell/QuickCapture.test.tsx
git commit -m "feat(web): route Quick Capture to the shopping list via destination toggle"
```

---

## Task 4: Verification & docs

- [ ] **Step 1: Typecheck, lint (changed packages), and full test suite**

Run:
```bash
pnpm --filter @lifesync/ui build
pnpm typecheck
pnpm --filter web lint
pnpm test
```
Expected: typecheck clean; web lint clean; all tests pass. New tests: `useStickyDestination` (3) + the QuickCapture additions (web), and SegmentedControl still 3 (ui). (The pre-existing `@lifesync/ui` lint error in `Avatar.tsx` — `@next/next/no-img-element` rule not found — exists on `main` and is unrelated; that's why this step lints only `web`.)

- [ ] **Step 2: Manual smoke (recommended)**

`pnpm dev --filter=web` (+ `--filter=api`), open the app, press the quick-capture FAB:
- Default is Inbox; type a note + Enter → saved, sheet closes (unchanged).
- Switch to Shopping list → placeholder changes; type `milk` Enter `eggs` Enter → both land on `/household` shopping list, sheet stays open with "✓ Added to shopping list".
- Close and reopen the sheet → it remembers Shopping list (sticky).
- Resize to mobile width → sheet is usable, toggle is tappable, keyboard stays up during burst add.

- [ ] **Step 3: Update CLAUDE.md status**

In `CLAUDE.md`:
- Bump the test-count line in the Development Status blockquote to the new totals from Step 1.
- In the **Quick capture / Inbox** "Done ✅" bullet, note that Quick Capture can now route to the **Household shopping list** (sticky Inbox | Shopping list toggle), in addition to the Inbox.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note Quick Capture shopping-list destination in status"
```

---

## Self-Review Notes (verified against the spec)

- **§2 segmented toggle, default Inbox, sticky** → Task 2 (hook) + Task 3 (toggle wired to it).
- **§3 Inbox → close; Shopping → stay open, clear, inline confirmation, keep focus** → Task 3 `capture`/`add` `onSuccess` handlers + `justAdded`.
- **§3 visual cue: shopping placeholder + label** → Task 3 (`SHOPPING_PLACEHOLDER`, `Add to list`).
- **§3 minimal payload `{ name, status: 'on_list' }`** → Task 3 `submit()`.
- **§4 invalidate own list; errors keep sheet open + preserve text** → Task 3 (`isError` branch; no `onClose` on the add path).
- **§5 SSR-safe localStorage hook, default inbox, invalid-value fallback** → Task 2.
- **§6 mobile parity (keep keyboard up, non-dismissing confirmation, touch targets)** → Task 3 (no blur/close on add; inline `.added`; SegmentedControl tokens fixed in Task 1 so the 44px segments render on-theme) + Step 2 mobile smoke.
- **§7 tests** → Task 2 (hook) + Task 3 (6 QuickCapture cases).
- **Token-correctness fix** (SegmentedControl now in the prominent sheet) → Task 1; household-local token mismatch explicitly deferred (see File Structure note).
