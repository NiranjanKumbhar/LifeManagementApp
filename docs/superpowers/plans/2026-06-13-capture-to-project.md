# Quick Capture → Project (+ New Project on the Go) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Quick Capture file an item straight into an existing project (as a task) or a brand-new project created on the spot, via a single `To: ▾` destination picker that replaces the Inbox|Shopping toggle.

**Architecture:** Pure frontend. Generalize `useStickyDestination` to a discriminated `CaptureDestination` union; add a `DestinationPicker` and a `QuickProjectPanel` component; rewrite `QuickCapture` to orchestrate routing across `inbox.capture` / `household.add` / `task.create` / `project.create`. No backend changes.

**Tech Stack:** Next.js 15 (client components), tRPC v11 + React Query, `@lifesync/ui`, Vitest + RTL + `@testing-library/user-event`, CSS Modules with `--ls-*` tokens.

**Spec:** `docs/superpowers/specs/2026-06-13-capture-to-project-design.md`

**Key reference facts (verified against the codebase):**
- `QuickCapture.tsx` (`apps/web/src/components/app-shell/`) currently uses a `SegmentedControl` toggle bound to `useStickyDestination` returning `'inbox' | 'shopping'`, with `inbox.capture` and `household.add` mutations. Input `aria-label` is `"What's on your mind?"` (keep it).
- `task.create` input: `{ projectId, title, ... }` — minimal `{ projectId, title }`. `project.create` input: `{ workspaceId, type, title, ... }` — minimal `{ workspaceId, type, title }`; it **returns the created project (with `id` and `title`)**.
- `project.list` input accepts `{ workspaceId, status }`; `'active'` filters to active projects; returns rows with `id`, `title`, etc.
- Invalidation keys: `utils.inbox.list`, `utils.household.list`, `utils.project.list` (all `{ workspaceId }`), `utils.project.get` (`{ id }`).
- Project types: `PROJECT_TYPE_ORDER` + `PROJECT_TYPE_META[t].label` from `apps/web/src/lib/projects/project-meta.tsx`. `ProjectType` from `@lifesync/shared-types`.
- `Input` from `@lifesync/ui`: `{ label, value, onChange, required?, placeholder? }` + `as="select"` with `options`. `Button` variants include `ghost`.
- React Query `useMutation` `onSuccess` receives `(data, variables)`; `onError` is available. The repo's test mock pattern calls `opts.onSuccess?.(returnValue, vars)` synchronously inside `mutate`.
- `renderHook` is available from `@testing-library/react` (v16).

---

## File Structure

**New (web):**
- `apps/web/src/components/app-shell/DestinationPicker.tsx` (+ `.module.css`, `.test.tsx`)
- `apps/web/src/components/app-shell/QuickProjectPanel.tsx` (+ `.module.css`, `.test.tsx`)

**Modified (web):**
- `apps/web/src/lib/hooks/useStickyDestination.ts` (+ `.test.ts`) — generalize to the union
- `apps/web/src/components/app-shell/QuickCapture.tsx` (+ `.module.css`, `.test.tsx`)
- `CLAUDE.md`

**No changes** to API / shared-types / DB. `SegmentedControl` stays in `@lifesync/ui` (still used by `/household`).

---

## Task 1: Generalize `useStickyDestination` to the `CaptureDestination` union

**Files:**
- Modify: `apps/web/src/lib/hooks/useStickyDestination.ts`
- Modify: `apps/web/src/lib/hooks/useStickyDestination.test.ts`
- Modify: `apps/web/src/components/app-shell/QuickCapture.tsx` (minimal adaptation, behavior unchanged)

The hook moves from a `'inbox' | 'shopping'` string to a discriminated union that also encodes a project id. QuickCapture is adapted just enough to compile and keep its current behavior; the picker/project routing come in later tasks.

- [ ] **Step 1: Rewrite the hook test**

Overwrite `apps/web/src/lib/hooks/useStickyDestination.test.ts`:

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
    expect(result.current[0]).toEqual({ kind: 'inbox' });
  });

  it('persists shopping and re-reads it on a fresh mount', () => {
    const first = renderHook(() => useStickyDestination());
    act(() => first.result.current[1]({ kind: 'shopping' }));
    expect(window.localStorage.getItem(CAPTURE_DESTINATION_KEY)).toBe('shopping');
    const second = renderHook(() => useStickyDestination());
    expect(second.result.current[0]).toEqual({ kind: 'shopping' });
  });

  it('round-trips a project destination', () => {
    const first = renderHook(() => useStickyDestination());
    act(() => first.result.current[1]({ kind: 'project', projectId: 'p1' }));
    expect(window.localStorage.getItem(CAPTURE_DESTINATION_KEY)).toBe('project:p1');
    const second = renderHook(() => useStickyDestination());
    expect(second.result.current[0]).toEqual({ kind: 'project', projectId: 'p1' });
  });

  it('falls back to inbox for an invalid stored value', () => {
    window.localStorage.setItem(CAPTURE_DESTINATION_KEY, 'garbage');
    const { result } = renderHook(() => useStickyDestination());
    expect(result.current[0]).toEqual({ kind: 'inbox' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- useStickyDestination`
Expected: FAIL (the hook still returns strings).

- [ ] **Step 3: Rewrite the hook**

Overwrite `apps/web/src/lib/hooks/useStickyDestination.ts`:

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';

export type CaptureDestination =
  | { kind: 'inbox' }
  | { kind: 'shopping' }
  | { kind: 'project'; projectId: string };

export const CAPTURE_DESTINATION_KEY = 'lifesync.capture.destination';

function serialize(dest: CaptureDestination): string {
  return dest.kind === 'project' ? `project:${dest.projectId}` : dest.kind;
}

function parse(raw: string | null): CaptureDestination {
  if (raw === 'inbox') return { kind: 'inbox' };
  if (raw === 'shopping') return { kind: 'shopping' };
  if (raw && raw.startsWith('project:')) {
    const projectId = raw.slice('project:'.length);
    if (projectId) return { kind: 'project', projectId };
  }
  return { kind: 'inbox' };
}

/**
 * The Quick Capture destination, remembered across sessions in localStorage.
 * SSR-safe: starts at inbox and adopts the stored value after mount.
 */
export function useStickyDestination(): [CaptureDestination, (next: CaptureDestination) => void] {
  const [destination, setDestination] = useState<CaptureDestination>({ kind: 'inbox' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setDestination(parse(window.localStorage.getItem(CAPTURE_DESTINATION_KEY)));
  }, []);

  const set = useCallback((next: CaptureDestination) => {
    setDestination(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CAPTURE_DESTINATION_KEY, serialize(next));
    }
  }, []);

  return [destination, set];
}
```

- [ ] **Step 4: Adapt `QuickCapture.tsx` minimally (keep current behavior)**

In `apps/web/src/components/app-shell/QuickCapture.tsx`, change the destination usages from the string form to the union form. Replace the line:

```tsx
  const isShopping = destination === 'shopping';
```
with:
```tsx
  const isShopping = destination.kind === 'shopping';
```

And replace the `SegmentedControl` block's `value`/`onChange`:

```tsx
          <SegmentedControl
            ariaLabel="Capture destination"
            value={destination}
            onChange={(v) => {
              setDestination(v as 'inbox' | 'shopping');
              setJustAdded(false);
            }}
```
with:
```tsx
          <SegmentedControl
            ariaLabel="Capture destination"
            value={destination.kind === 'shopping' ? 'shopping' : 'inbox'}
            onChange={(v) => {
              setDestination(v === 'shopping' ? { kind: 'shopping' } : { kind: 'inbox' });
              setJustAdded(false);
            }}
```

(No other changes — the picker and project routing arrive in Task 4.)

- [ ] **Step 5: Run hook + QuickCapture tests to verify they pass**

Run: `pnpm --filter web test -- useStickyDestination QuickCapture`
Expected: PASS (hook 4 + QuickCapture 6 — unchanged behavior).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/lib/hooks/useStickyDestination.ts apps/web/src/lib/hooks/useStickyDestination.test.ts apps/web/src/components/app-shell/QuickCapture.tsx
git commit -m "refactor(web): generalize useStickyDestination to a CaptureDestination union"
```

---

## Task 2: `DestinationPicker` component

**Files:**
- Create: `apps/web/src/components/app-shell/DestinationPicker.tsx`
- Create: `apps/web/src/components/app-shell/DestinationPicker.module.css`
- Test: `apps/web/src/components/app-shell/DestinationPicker.test.tsx`

A presentational `To: ▾` dropdown. Inbox + Shopping pinned, then projects (with a search field when there are more than 5), then `+ New project…`. Closes on outside `mousedown` / Escape.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/app-shell/DestinationPicker.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DestinationPicker } from './DestinationPicker';

const projects = [
  { id: 'p1', title: 'Japan trip' },
  { id: 'p2', title: "Mum's 60th" },
];

function setup(overrides: Partial<Parameters<typeof DestinationPicker>[0]> = {}) {
  const onSelect = vi.fn();
  const onNewProject = vi.fn();
  render(
    <DestinationPicker
      value={{ kind: 'inbox' }}
      label="Inbox"
      projects={projects}
      onSelect={onSelect}
      onNewProject={onNewProject}
      {...overrides}
    />,
  );
  return { onSelect, onNewProject };
}

describe('DestinationPicker', () => {
  it('shows the current label and opens the menu', async () => {
    setup();
    expect(screen.getByRole('button', { name: /To: Inbox/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /To:/ }));
    expect(screen.getByRole('menuitem', { name: 'Inbox' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Shopping list' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Japan trip' })).toBeInTheDocument();
  });

  it('selecting a project reports the project destination', async () => {
    const { onSelect } = setup();
    await userEvent.click(screen.getByRole('button', { name: /To:/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Japan trip' }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'project', projectId: 'p1' });
  });

  it('selecting Shopping list reports the shopping destination', async () => {
    const { onSelect } = setup();
    await userEvent.click(screen.getByRole('button', { name: /To:/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Shopping list' }));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'shopping' });
  });

  it('+ New project triggers onNewProject', async () => {
    const { onNewProject } = setup();
    await userEvent.click(screen.getByRole('button', { name: /To:/ }));
    await userEvent.click(screen.getByRole('menuitem', { name: '+ New project…' }));
    expect(onNewProject).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- DestinationPicker`
Expected: FAIL — cannot resolve `./DestinationPicker`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/app-shell/DestinationPicker.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CaptureDestination } from '@/lib/hooks/useStickyDestination';
import styles from './DestinationPicker.module.css';

export interface PickerProject {
  id: string;
  title: string;
}

export interface DestinationPickerProps {
  value: CaptureDestination;
  label: string;
  projects: PickerProject[];
  onSelect: (dest: CaptureDestination) => void;
  onNewProject: () => void;
}

export function DestinationPicker({ value, label, projects, onSelect, onNewProject }: DestinationPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? projects.filter((p) => p.title.toLowerCase().includes(q)) : projects;
  }, [projects, query]);

  const choose = (dest: CaptureDestination) => {
    onSelect(dest);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          To: <strong>{label}</strong>
        </span>
        <span aria-hidden="true" className={styles.caret}>
          ▾
        </span>
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          <button type="button" role="menuitem" className={styles.item} onClick={() => choose({ kind: 'inbox' })}>
            Inbox
          </button>
          <button type="button" role="menuitem" className={styles.item} onClick={() => choose({ kind: 'shopping' })}>
            Shopping list
          </button>
          {projects.length > 0 ? <div className={styles.divider} /> : null}
          {projects.length > 5 ? (
            <input
              className={styles.search}
              type="text"
              aria-label="Search projects"
              placeholder="Search projects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          ) : null}
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => choose({ kind: 'project', projectId: p.id })}
            >
              {p.title}
            </button>
          ))}
          <div className={styles.divider} />
          <button
            type="button"
            role="menuitem"
            className={styles.newItem}
            onClick={() => {
              onNewProject();
              setOpen(false);
              setQuery('');
            }}
          >
            + New project…
          </button>
        </div>
      ) : null}
    </div>
  );
}
```

Create `apps/web/src/components/app-shell/DestinationPicker.module.css`:

```css
.root {
  position: relative;
  display: inline-block;
}

.trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--ls-surface-sunken);
  border: 1px solid var(--ls-surface-border);
  border-radius: var(--ls-radius-full);
  padding: 0.3rem 0.75rem;
  font: inherit;
  font-size: var(--ls-text-sm);
  color: var(--ls-text-secondary);
  cursor: pointer;
}

.trigger strong {
  color: var(--ls-text-primary);
  font-weight: 600;
}

.trigger:focus-visible {
  outline: 2px solid var(--ls-primary-600);
  outline-offset: 2px;
}

.caret {
  font-size: 0.7rem;
  color: var(--ls-text-tertiary);
}

.menu {
  position: absolute;
  left: 0;
  top: calc(100% + 0.3rem);
  z-index: 70;
  min-width: 14rem;
  max-height: 18rem;
  overflow-y: auto;
  padding: 0.3rem;
  background: var(--ls-surface-elevated);
  border: 1px solid var(--ls-surface-border);
  border-radius: var(--ls-radius-lg);
  box-shadow: var(--ls-shadow-lg);
}

.item,
.newItem {
  display: block;
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 0.5rem 0.6rem;
  border-radius: var(--ls-radius-sm);
  font: inherit;
  color: var(--ls-text-primary);
  cursor: pointer;
}

.newItem {
  color: var(--ls-primary-700);
  font-weight: 600;
}

.item:hover,
.item:focus-visible,
.newItem:hover,
.newItem:focus-visible {
  background: var(--ls-surface-sunken);
  outline: none;
}

.divider {
  height: 1px;
  margin: 0.3rem 0.2rem;
  background: var(--ls-surface-border);
}

.search {
  width: 100%;
  box-sizing: border-box;
  margin: 0.2rem 0;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--ls-surface-border);
  border-radius: var(--ls-radius-sm);
  font: inherit;
  font-size: var(--ls-text-sm);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- DestinationPicker`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app-shell/DestinationPicker.tsx apps/web/src/components/app-shell/DestinationPicker.module.css apps/web/src/components/app-shell/DestinationPicker.test.tsx
git commit -m "feat(web): add DestinationPicker for Quick Capture"
```

---

## Task 3: `QuickProjectPanel` component

**Files:**
- Create: `apps/web/src/components/app-shell/QuickProjectPanel.tsx`
- Create: `apps/web/src/components/app-shell/QuickProjectPanel.module.css`
- Test: `apps/web/src/components/app-shell/QuickProjectPanel.test.tsx`

The inline quick-create form: name + type + a "first task" preview + Create/Cancel.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/app-shell/QuickProjectPanel.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickProjectPanel } from './QuickProjectPanel';

describe('QuickProjectPanel', () => {
  it('shows the captured text as the first task', () => {
    render(
      <QuickProjectPanel capturedText="call the caterer" busy={false} onCreate={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByText(/call the caterer/)).toBeInTheDocument();
  });

  it('creates with the entered name and type', async () => {
    const onCreate = vi.fn();
    render(<QuickProjectPanel capturedText="" busy={false} onCreate={onCreate} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText(/Name/), "Mum's 60th");
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'occasion');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(onCreate).toHaveBeenCalledWith("Mum's 60th", 'occasion');
  });

  it('disables Create until a name is entered', () => {
    render(<QuickProjectPanel capturedText="" busy={false} onCreate={() => {}} onCancel={() => {}} />);
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });

  it('Cancel calls onCancel', async () => {
    const onCancel = vi.fn();
    render(<QuickProjectPanel capturedText="" busy={false} onCreate={() => {}} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- QuickProjectPanel`
Expected: FAIL — cannot resolve `./QuickProjectPanel`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/app-shell/QuickProjectPanel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { ProjectType } from '@lifesync/shared-types';
import { Button, Input } from '@lifesync/ui';
import { PROJECT_TYPE_META, PROJECT_TYPE_ORDER } from '@/lib/projects/project-meta';
import styles from './QuickProjectPanel.module.css';

export interface QuickProjectPanelProps {
  capturedText: string;
  busy: boolean;
  onCreate: (name: string, type: ProjectType) => void;
  onCancel: () => void;
}

const TYPE_OPTIONS = PROJECT_TYPE_ORDER.map((t) => ({ value: t, label: PROJECT_TYPE_META[t].label }));

export function QuickProjectPanel({ capturedText, busy, onCreate, onCancel }: QuickProjectPanelProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('general');

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>New project</h2>
      <Input label="Name" value={name} onChange={setName} required placeholder="e.g. Mum's 60th" />
      <Input
        as="select"
        label="Type"
        value={type}
        onChange={(v) => setType(v as ProjectType)}
        options={TYPE_OPTIONS}
      />
      {capturedText ? (
        <p className={styles.preview}>
          First task: <strong>{capturedText}</strong>
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            const trimmed = name.trim();
            if (trimmed) onCreate(trimmed, type);
          }}
          disabled={!name.trim() || busy}
        >
          {busy ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </div>
  );
}
```

Create `apps/web/src/components/app-shell/QuickProjectPanel.module.css`:

```css
.panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.heading {
  margin: 0;
  font-family: var(--ls-font-display);
  font-size: var(--ls-text-lg);
  color: var(--ls-text-primary);
}

.preview {
  margin: 0;
  font-size: var(--ls-text-sm);
  color: var(--ls-text-secondary);
}

.preview strong {
  color: var(--ls-text-primary);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- QuickProjectPanel`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/app-shell/QuickProjectPanel.tsx apps/web/src/components/app-shell/QuickProjectPanel.module.css apps/web/src/components/app-shell/QuickProjectPanel.test.tsx
git commit -m "feat(web): add QuickProjectPanel for on-the-go project creation"
```

---

## Task 4: Wire the picker, project routing, and new-project into `QuickCapture`

**Files:**
- Modify: `apps/web/src/components/app-shell/QuickCapture.tsx`
- Modify: `apps/web/src/components/app-shell/QuickCapture.module.css`
- Modify: `apps/web/src/components/app-shell/QuickCapture.test.tsx`

- [ ] **Step 1: Overwrite the test file**

Overwrite `apps/web/src/components/app-shell/QuickCapture.test.tsx`:

```tsx
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { captureMutate, addMutate, taskMutate, projectMutate } = vi.hoisted(() => ({
  captureMutate: vi.fn(),
  addMutate: vi.fn(),
  taskMutate: vi.fn(),
  projectMutate: vi.fn(),
}));

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => {
  const mut = (spy: (v: unknown) => void, result?: unknown) => ({
    useMutation: (opts: { onSuccess?: (d: unknown, v: unknown) => void; onError?: () => void }) => ({
      mutate: (vars: unknown) => {
        spy(vars);
        opts?.onSuccess?.(result, vars);
      },
      isPending: false,
    }),
  });
  return {
    trpc: {
      useUtils: () => ({
        inbox: { list: { invalidate: vi.fn() } },
        household: { list: { invalidate: vi.fn() } },
        project: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } },
      }),
      project: {
        list: {
          useQuery: () => ({
            data: [
              { id: 'p1', title: 'Japan trip' },
              { id: 'p2', title: "Mum's 60th" },
            ],
          }),
        },
        create: mut(projectMutate, { id: 'p3', title: 'New thing' }),
      },
      inbox: { capture: mut(captureMutate) },
      household: { add: mut(addMutate) },
      task: { create: mut(taskMutate) },
    },
  };
});

import { QuickCapture } from './QuickCapture';

beforeEach(() => {
  window.localStorage.clear();
  captureMutate.mockClear();
  addMutate.mockClear();
  taskMutate.mockClear();
  projectMutate.mockClear();
});

async function openPicker() {
  await userEvent.click(screen.getByRole('button', { name: /To:/ }));
}

describe('QuickCapture', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<QuickCapture open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('defaults to Inbox: captures the note and closes', async () => {
    const onClose = vi.fn();
    render(<QuickCapture open onClose={onClose} />);
    await userEvent.type(screen.getByLabelText("What's on your mind?"), 'Buy milk{Enter}');
    expect(captureMutate).toHaveBeenCalledWith({ workspaceId: 'ws-1', content: 'Buy milk' });
    expect(onClose).toHaveBeenCalled();
  });

  it('routes to a chosen project via task.create and stays open', async () => {
    const onClose = vi.fn();
    render(<QuickCapture open onClose={onClose} />);
    await openPicker();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Japan trip' }));
    const input = screen.getByLabelText("What's on your mind?");
    await userEvent.type(input, 'book the ryokan{Enter}');
    expect(taskMutate).toHaveBeenCalledWith({ projectId: 'p1', title: 'book the ryokan' });
    expect(onClose).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
  });

  it('creates a new project and files the captured text as its first task', async () => {
    render(<QuickCapture open onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText("What's on your mind?"), 'call the caterer');
    await openPicker();
    await userEvent.click(screen.getByRole('menuitem', { name: '+ New project…' }));
    await userEvent.type(screen.getByLabelText(/Name/), 'Party');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(projectMutate).toHaveBeenCalledWith({ workspaceId: 'ws-1', type: 'general', title: 'Party' });
    expect(taskMutate).toHaveBeenCalledWith({ projectId: 'p3', title: 'call the caterer' });
  });

  it('shows the shopping placeholder when Shopping list is chosen', async () => {
    render(<QuickCapture open onClose={() => {}} />);
    await openPicker();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Shopping list' }));
    expect(screen.getByPlaceholderText('Add to shopping list…')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web test -- QuickCapture`
Expected: FAIL — no `To:` picker yet, etc.

- [ ] **Step 3: Overwrite the component**

Overwrite `apps/web/src/components/app-shell/QuickCapture.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { ProjectType } from '@lifesync/shared-types';
import { Button } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { useStickyDestination } from '@/lib/hooks/useStickyDestination';
import { DestinationPicker } from './DestinationPicker';
import { QuickProjectPanel } from './QuickProjectPanel';
import styles from './QuickCapture.module.css';

export interface QuickCaptureProps {
  open: boolean;
  onClose: () => void;
}

type Feedback = { tone: 'success' | 'error'; msg: string };

const INBOX_PLACEHOLDER = 'Capture anything — a task, a reminder, an idea…';
const SHOPPING_PLACEHOLDER = 'Add to shopping list…';
const PROJECT_PLACEHOLDER = 'Add a task…';

export function QuickCapture({ open, onClose }: QuickCaptureProps) {
  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [mode, setMode] = useState<'capture' | 'new-project'>('capture');
  const [destination, setDestination] = useStickyDestination();
  const inputRef = useRef<HTMLInputElement>(null);
  const pending = useRef<{ ok: string; err: string }>({ ok: '', err: '' });
  const workspaceId = useWorkspaceId();
  const utils = trpc.useUtils();

  const projectsQuery = trpc.project.list.useQuery(
    { workspaceId: workspaceId ?? '', status: 'active' as const },
    { enabled: open && Boolean(workspaceId) },
  );
  const projects = useMemo(
    () => (projectsQuery.data ?? []).map((p) => ({ id: p.id, title: p.title })),
    [projectsQuery.data],
  );

  // A remembered project that's no longer active falls back to Inbox.
  useEffect(() => {
    if (
      destination.kind === 'project' &&
      projectsQuery.data &&
      !projectsQuery.data.some((p) => p.id === destination.projectId)
    ) {
      setDestination({ kind: 'inbox' });
    }
  }, [destination, projectsQuery.data, setDestination]);

  const clearFeedback = () => setFeedback(null);

  const capture = trpc.inbox.capture.useMutation({
    onSuccess: () => {
      if (workspaceId) void utils.inbox.list.invalidate({ workspaceId });
      setText('');
      onClose();
    },
    onError: () => setFeedback({ tone: 'error', msg: 'Couldn’t save — try again.' }),
  });

  const addItem = trpc.household.add.useMutation({
    onSuccess: () => {
      if (workspaceId) void utils.household.list.invalidate({ workspaceId });
      setText('');
      setFeedback({ tone: 'success', msg: '✓ Added to shopping list' });
      inputRef.current?.focus();
    },
    onError: () => setFeedback({ tone: 'error', msg: 'Couldn’t save — try again.' }),
  });

  const createTask = trpc.task.create.useMutation({
    onSuccess: (_data, variables: { projectId: string }) => {
      if (workspaceId) void utils.project.list.invalidate({ workspaceId });
      void utils.project.get.invalidate({ id: variables.projectId });
      setText('');
      setFeedback({ tone: 'success', msg: pending.current.ok });
      inputRef.current?.focus();
    },
    onError: () => setFeedback({ tone: 'error', msg: pending.current.err }),
  });

  const createProject = trpc.project.create.useMutation({
    onSuccess: (project: { id: string; title: string }) => {
      if (workspaceId) void utils.project.list.invalidate({ workspaceId });
      setDestination({ kind: 'project', projectId: project.id });
      setMode('capture');
      const firstTask = text.trim();
      if (firstTask) {
        pending.current = {
          ok: `✓ Created ${project.title}`,
          err: `Created ${project.title}, but the task didn’t save — try again.`,
        };
        createTask.mutate({ projectId: project.id, title: firstTask });
      } else {
        setText('');
        setFeedback({ tone: 'success', msg: `✓ Created ${project.title}` });
        inputRef.current?.focus();
      }
    },
    onError: () => setFeedback({ tone: 'error', msg: 'Couldn’t create the project — try again.' }),
  });

  useEffect(() => {
    if (open && mode === 'capture') inputRef.current?.focus();
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const label =
    destination.kind === 'inbox'
      ? 'Inbox'
      : destination.kind === 'shopping'
        ? 'Shopping list'
        : (projects.find((p) => p.id === destination.projectId)?.title ?? 'Inbox');

  const busy =
    capture.isPending || addItem.isPending || createTask.isPending || createProject.isPending;

  const placeholder =
    destination.kind === 'shopping'
      ? SHOPPING_PLACEHOLDER
      : destination.kind === 'project'
        ? PROJECT_PLACEHOLDER
        : INBOX_PLACEHOLDER;

  const submitLabel = busy
    ? 'Saving…'
    : destination.kind === 'shopping'
      ? 'Add to list'
      : destination.kind === 'project'
        ? 'Add task'
        : 'Add';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value || !workspaceId || busy) return;
    if (destination.kind === 'shopping') {
      addItem.mutate({ workspaceId, name: value, status: 'on_list' });
    } else if (destination.kind === 'project') {
      pending.current = { ok: `✓ Added to ${label}`, err: 'Couldn’t save — try again.' };
      createTask.mutate({ projectId: destination.projectId, title: value });
    } else {
      capture.mutate({ workspaceId, content: value });
    }
  };

  const createNewProject = (name: string, type: ProjectType) => {
    if (!workspaceId || busy) return;
    createProject.mutate({ workspaceId, type, title: name });
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
        {mode === 'new-project' ? (
          <QuickProjectPanel
            capturedText={text.trim()}
            busy={busy}
            onCreate={createNewProject}
            onCancel={() => {
              setMode('capture');
              clearFeedback();
              inputRef.current?.focus();
            }}
          />
        ) : (
          <>
            <div className={styles.picker}>
              <DestinationPicker
                value={destination}
                label={label}
                projects={projects}
                onSelect={(dest) => {
                  setDestination(dest);
                  clearFeedback();
                }}
                onNewProject={() => {
                  setMode('new-project');
                  clearFeedback();
                }}
              />
            </div>
            <form onSubmit={submit}>
              <input
                ref={inputRef}
                className={styles.input}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  clearFeedback();
                }}
                placeholder={placeholder}
                aria-label="What's on your mind?"
                autoComplete="off"
              />
              <div className={styles.row}>
                <span className={styles.hint}>
                  {feedback ? (
                    <span className={feedback.tone === 'error' ? styles.error : styles.added}>
                      {feedback.msg}
                    </span>
                  ) : destination.kind === 'inbox' ? (
                    'Press Enter to save · Esc to close'
                  ) : (
                    'Enter to add · Esc to close'
                  )}
                </span>
                <Button type="submit" size="sm" disabled={!text.trim() || busy}>
                  {submitLabel}
                </Button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update the stylesheet**

In `apps/web/src/components/app-shell/QuickCapture.module.css`, replace the `.toggle` rule with a `.picker` rule (same intent — spacing above the input):

```css
.picker {
  display: flex;
  margin-bottom: var(--ls-space-3);
}
```

(Keep the existing `.added` rule. If `.toggle` is no longer referenced anywhere, remove it.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter web test -- QuickCapture`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/app-shell/QuickCapture.tsx apps/web/src/components/app-shell/QuickCapture.module.css apps/web/src/components/app-shell/QuickCapture.test.tsx
git commit -m "feat(web): route Quick Capture to projects and create projects on the go"
```

---

## Task 5: Verification & docs

- [ ] **Step 1: Typecheck, web lint, and full test suite**

Run:
```bash
pnpm typecheck
pnpm --filter web lint
pnpm test
```
Expected: typecheck clean; web lint clean; all tests pass. New web tests: `DestinationPicker` (4) + `QuickProjectPanel` (4) + the rewritten `QuickCapture` (5) + `useStickyDestination` (4). (The pre-existing `@lifesync/ui` `Avatar.tsx` lint error exists on `main` and is unrelated — that's why this lints only `web`.)

- [ ] **Step 2: Manual smoke (recommended)**

`pnpm dev --filter=web` (+ `--filter=api`), open the quick-capture FAB:
- `To:` shows Inbox; type a note + Enter → saved, sheet closes.
- Open `To:` → pick a project → type a task + Enter → it appears under that project (`/projects/[id]`); sheet stays open; burst-add more.
- Open `To:` → `+ New project…` → name + type → Create → project created with the typed text as its first task; subsequent captures flow into the new project.
- Reopen the sheet → it remembers the last project; archive/delete that project, reopen → falls back to Inbox.
- Resize to mobile width → picker menu is usable and thumb-reachable.

- [ ] **Step 3: Update CLAUDE.md**

In `CLAUDE.md`:
- Bump the test-count line in the Development Status blockquote to the totals from Step 1.
- Extend the **Quick capture / Inbox** "Done ✅" bullet: Quick Capture now routes via a `To: ▾` destination picker to Inbox, the Household shopping list, **an existing project (creates a task)**, or a **new project created on the go** (name + type; the capture becomes its first task).

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note Quick Capture project routing + on-the-go project creation"
```

---

## Self-Review Notes (verified against the spec)

- **§3 destination union** → Task 1 (`CaptureDestination`).
- **§4.1 DestinationPicker (Inbox/Shopping/projects/search/+New)** → Task 2.
- **§4.3 quick-create panel (name + type + first-task preview)** → Task 3 (`QuickProjectPanel`).
- **§5.1 routing: inbox→capture+close; shopping→add+stay; project→task.create+invalidate get/list+stay** → Task 4 `submit`.
- **§5.2 new project: project.create → first task via task.create → sticky to new project** → Task 4 `createProject.onSuccess`.
- **§6 generalized sticky hook + project fallback to Inbox** → Task 1 (hook) + Task 4 (fallback effect + label).
- **§7 errors scoped + new-project partial-failure message; mobile picker** → Task 4 (`pending` ok/err + per-mutation onError) + picker CSS in Task 2.
- **§8 tests** → Tasks 1–4 (hook, picker, panel, QuickCapture flows).
- **Type/name consistency:** `CaptureDestination`, `pending.current.{ok,err}`, `project.create` returns `{ id, title }`, `task.create({ projectId, title })`, `project.list({ status: 'active' })` used identically across tasks.
