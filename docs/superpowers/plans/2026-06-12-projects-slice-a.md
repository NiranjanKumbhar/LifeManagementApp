# Projects Slice A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the web Projects experience — a list grouped by type with progress bars, a single-column detail page with an interactive task list, and a template-driven create/edit modal — plus the five reusable UI components it introduces.

**Architecture:** One additive backend change exposes task counts on `project.list`. Five framework-agnostic components land in `@lifesync/ui`. Web pages (`/projects`, `/projects/[id]`) and a `ProjectForm` consume them via the existing tRPC + React Query setup. A web-side registry maps each `ProjectType` to its icon, label, and per-type custom-field definitions.

**Tech Stack:** TypeScript, Drizzle ORM, tRPC v11, React 18, Next.js 15 (App Router), CSS Modules, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-12-projects-slice-a-design.md`

**Conventions to follow:**
- Components mirror `packages/ui/src/components/Button/` (forwardRef where it makes sense, `cn()` for class joins, co-located `*.module.css` + `*.test.tsx` + `index.ts`, export from `packages/ui/src/index.ts`).
- CSS uses `--ls-*` custom properties (e.g. `--ls-space-4`, `--ls-primary-600`, `--ls-surface-card`, `--ls-radius-lg`, `--ls-text-sm`).
- Web pages are client components mirroring `apps/web/src/app/(app)/inbox/page.tsx`.
- Web tests mock `@/lib/trpc` and `@/lib/hooks/useWorkspaceId` exactly like `QuickCapture.test.tsx`.
- Run the full suite with `pnpm test`; per package with `pnpm test --filter=@lifesync/ui` / `--filter=web` / `--filter=api`.
- Commit after every task (Conventional Commits). Append `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` to commit messages.

---

## File Structure

**Shared types (`packages/shared-types/src/`):**
- `api/outputs.ts` — add `ProjectListItem`.

**API (`apps/api/src/`):**
- `services/project.service.ts` — `list` returns task counts.
- `services/project.service.test.ts` *(or extend `routers/project.test.ts`)* — counts test.

**UI package (`packages/ui/src/components/`):** one folder each —
- `Input/` `Modal/` `Toast/` `TaskItem/` `ProjectCard/` (`.tsx`, `.module.css`, `.test.tsx`, `index.ts`)
- plus barrel exports in `packages/ui/src/index.ts`.

**Web (`apps/web/src/`):**
- `components/icons.tsx` — add type icons (Shield, Plane, Stethoscope, Compass).
- `lib/projects/project-meta.ts` — `PROJECT_TYPE_META` (icon + label + order).
- `lib/projects/field-registry.ts` — `PROJECT_FIELD_REGISTRY` + `ProjectFieldDef`.
- `components/projects/ProjectForm.tsx` (+ `.module.css`) — create/edit modal body.
- `app/(app)/projects/page.tsx` (+ `projects.module.css`, `loading.tsx`).
- `app/(app)/projects/[id]/page.tsx` (+ `project-detail.module.css`).
- `lib/providers.tsx` — wrap children in `ToastProvider`.

---

## Task 1: Backend — task counts on `project.list`

**Files:**
- Modify: `packages/shared-types/src/api/outputs.ts`
- Modify: `apps/api/src/services/project.service.ts`
- Test: `apps/api/src/routers/project.test.ts`

- [ ] **Step 1: Add the output type**

In `packages/shared-types/src/api/outputs.ts`, alongside the existing project imports/types, add:

```ts
/** A project list row enriched with task progress counts. */
export interface ProjectListItem extends Project {
  taskCount: number;
  completedCount: number;
}
```

Ensure `ProjectListItem` is exported from the package barrel (it is re-exported automatically if `outputs.ts` is part of `src/index.ts`; verify `export * from './api/outputs'` exists in `packages/shared-types/src/index.ts` and add it if missing).

- [ ] **Step 2: Write the failing test**

Append to `apps/api/src/routers/project.test.ts` inside the `describe('projectRouter — member flows', …)` block:

```ts
it('returns task counts on list rows', async () => {
  const caller = callerFor(ctx.db, world.alex.clerkId);
  const project = await caller.project.create(
    createProjectInput({ workspaceId: world.workspace.id, title: 'Counts' }),
  );
  const a = await caller.task.create({ projectId: project.id, title: 'A' });
  await caller.task.create({ projectId: project.id, title: 'B' });
  await caller.task.complete({ id: a.id });

  const list = await caller.project.list({ workspaceId: world.workspace.id });
  const row = list.find((p) => p.id === project.id);
  expect(row).toBeDefined();
  expect(row).toMatchObject({ taskCount: 2, completedCount: 1 });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm test --filter=api -- project.test`
Expected: FAIL — `taskCount`/`completedCount` are `undefined` on the row.

- [ ] **Step 4: Implement the counts in the service**

In `apps/api/src/services/project.service.ts`, locate `static async list(...)`. Replace the body's query + return so it joins per-project task aggregates. Add `tasks`, `count`, and `eq`/`sql` imports if not already present (they are used elsewhere in the file). Replace the `const rows = await db.select()...` / `return ok(rows)` block with:

```ts
const rows = await db
  .select({
    project: projects,
    taskCount: sql<number>`count(${tasks.id})`.mapWith(Number),
    completedCount: sql<number>`count(${tasks.id}) filter (where ${tasks.status} = 'completed')`.mapWith(Number),
  })
  .from(projects)
  .leftJoin(tasks, eq(tasks.projectId, projects.id))
  .where(and(...conditions))
  .groupBy(projects.id)
  .orderBy(sql`${projects.dueDate} asc nulls last`, desc(projects.createdAt));

return ok(rows.map((r) => ({ ...r.project, taskCount: r.taskCount, completedCount: r.completedCount })));
```

Update the function's return type from `Result<ProjectRow[], AppError>` to `Result<ProjectListItem[], AppError>` and import `ProjectListItem` from `@lifesync/shared-types`. (`tasks` is already imported in this file — confirm; if not, add it to the `../db/schema` import.)

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test --filter=api -- project.test`
Expected: PASS. Also run `pnpm test --filter=api` to confirm no existing project tests broke (they assert on row fields that still exist).

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm typecheck
git add packages/shared-types apps/api
git commit -m "feat(api): expose task counts on project.list"
```

---

## Task 2: UI — `Input`

**Files:**
- Create: `packages/ui/src/components/Input/Input.tsx`
- Create: `packages/ui/src/components/Input/Input.module.css`
- Create: `packages/ui/src/components/Input/Input.test.tsx`
- Create: `packages/ui/src/components/Input/index.ts`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/ui/src/components/Input/Input.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './Input';

describe('Input', () => {
  it('associates the label with the control', () => {
    render(<Input label="Title" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
  });

  it('renders error text and marks the control invalid', () => {
    render(<Input label="Title" value="" onChange={() => {}} error="Required" />);
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders a textarea when multiline', () => {
    render(<Input label="Notes" value="" onChange={() => {}} as="textarea" />);
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --filter=@lifesync/ui -- Input`
Expected: FAIL — cannot resolve `./Input`.

- [ ] **Step 3: Implement the component**

`packages/ui/src/components/Input/Input.tsx`:

```tsx
import { useId, type ChangeEvent, type ReactNode } from 'react';
import { cn } from '../../utils/cn';
import styles from './Input.module.css';

type BaseProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  placeholder?: string;
  id?: string;
};

type TextProps = BaseProps & {
  as?: 'input';
  type?: 'text' | 'number' | 'date';
};
type TextareaProps = BaseProps & { as: 'textarea'; rows?: number };
type SelectProps = BaseProps & {
  as: 'select';
  options: Array<{ value: string; label: string }>;
};

export type InputProps = TextProps | TextareaProps | SelectProps;

export function Input(props: InputProps) {
  const { label, value, onChange, error, helperText, required, placeholder, id } = props;
  const autoId = useId();
  const fieldId = id ?? autoId;
  const describedBy = error ? `${fieldId}-error` : helperText ? `${fieldId}-help` : undefined;

  const shared = {
    id: fieldId,
    value,
    required,
    placeholder,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: cn(styles.control, error && styles.invalid),
  } as const;

  let control: ReactNode;
  if (props.as === 'textarea') {
    control = (
      <textarea
        {...shared}
        rows={props.rows ?? 3}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      />
    );
  } else if (props.as === 'select') {
    control = (
      <select {...shared} onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else {
    control = (
      <input
        {...shared}
        type={props.type ?? 'text'}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={fieldId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {control}
      {error ? (
        <p id={`${fieldId}-error`} className={styles.error}>
          {error}
        </p>
      ) : helperText ? (
        <p id={`${fieldId}-help`} className={styles.help}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
```

`packages/ui/src/components/Input/Input.module.css`:

```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--ls-space-1);
}
.label {
  font-size: var(--ls-text-sm);
  font-weight: 500;
  color: var(--ls-text-secondary);
}
.control {
  width: 100%;
  padding: var(--ls-space-2) var(--ls-space-3);
  font: inherit;
  font-size: var(--ls-text-base);
  color: var(--ls-text-primary);
  background: var(--ls-surface-elevated);
  border: 1px solid var(--ls-surface-border-strong);
  border-radius: var(--ls-radius-md);
  transition: border-color var(--ls-duration-micro) var(--ls-ease-standard);
}
.control:focus {
  outline: none;
  border-color: var(--ls-primary-500);
  box-shadow: var(--ls-shadow-focus);
}
.invalid {
  border-color: var(--ls-urgency-overdue);
}
.error {
  font-size: var(--ls-text-xs);
  color: var(--ls-urgency-overdue);
  margin: 0;
}
.help {
  font-size: var(--ls-text-xs);
  color: var(--ls-text-tertiary);
  margin: 0;
}
```

`packages/ui/src/components/Input/index.ts`:

```ts
export { Input, type InputProps } from './Input';
```

- [ ] **Step 4: Export from the barrel**

In `packages/ui/src/index.ts`, add under the Components section:

```ts
export { Input, type InputProps } from './components/Input/Input';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test --filter=@lifesync/ui -- Input`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): add Input component"
```

---

## Task 3: UI — `Modal`

**Files:**
- Create: `packages/ui/src/components/Modal/Modal.tsx`
- Create: `packages/ui/src/components/Modal/Modal.module.css`
- Create: `packages/ui/src/components/Modal/Modal.test.tsx`
- Create: `packages/ui/src/components/Modal/index.ts`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/ui/src/components/Modal/Modal.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="Edit">
        body
      </Modal>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders its title and children when open', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Edit project">
        <p>Form here</p>
      </Modal>,
    );
    expect(screen.getByRole('dialog', { name: 'Edit project' })).toBeInTheDocument();
    expect(screen.getByText('Form here')).toBeInTheDocument();
  });

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Edit">
        body
      </Modal>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when the overlay is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Edit">
        body
      </Modal>,
    );
    await userEvent.click(screen.getByTestId('modal-overlay'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --filter=@lifesync/ui -- Modal`
Expected: FAIL — cannot resolve `./Modal`.

- [ ] **Step 3: Implement the component**

`packages/ui/src/components/Modal/Modal.tsx`:

```tsx
import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './Modal.module.css';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) panelRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      data-testid="modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
        </header>
        <div className={styles.body}>{children}</div>
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </div>
  );
}
```

`packages/ui/src/components/Modal/Modal.module.css`:

```css
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--ls-space-4);
  background: var(--ls-surface-overlay);
  animation: fade var(--ls-duration-micro) var(--ls-ease-entrance);
}
.panel {
  width: 100%;
  max-width: 32rem;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--ls-surface-card);
  border-radius: var(--ls-radius-xl);
  box-shadow: var(--ls-shadow-xl);
  animation: rise var(--ls-duration-standard) var(--ls-ease-entrance);
}
.header {
  padding: var(--ls-space-5) var(--ls-space-5) 0;
}
.title {
  font-family: var(--ls-font-display);
  font-size: var(--ls-text-xl);
  margin: 0;
  color: var(--ls-text-primary);
}
.body {
  padding: var(--ls-space-4) var(--ls-space-5);
}
.footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--ls-space-2);
  padding: 0 var(--ls-space-5) var(--ls-space-5);
}
@keyframes fade {
  from { opacity: 0; }
}
@keyframes rise {
  from { opacity: 0; transform: translateY(8px); }
}
@media (prefers-reduced-motion: reduce) {
  .overlay, .panel { animation: none; }
}
```

`packages/ui/src/components/Modal/index.ts`:

```ts
export { Modal, type ModalProps } from './Modal';
```

- [ ] **Step 4: Export from the barrel**

In `packages/ui/src/index.ts` add:

```ts
export { Modal, type ModalProps } from './components/Modal/Modal';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test --filter=@lifesync/ui -- Modal`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): add Modal component"
```

---

## Task 4: UI — `Toast`

**Files:**
- Create: `packages/ui/src/components/Toast/Toast.tsx`
- Create: `packages/ui/src/components/Toast/Toast.module.css`
- Create: `packages/ui/src/components/Toast/Toast.test.tsx`
- Create: `packages/ui/src/components/Toast/index.ts`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/ui/src/components/Toast/Toast.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './Toast';

function Trigger() {
  const toast = useToast();
  return <button onClick={() => toast.success('Saved!')}>fire</button>;
}

describe('Toast', () => {
  it('shows a toast when fired through the hook', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'fire' }));
    expect(await screen.findByText('Saved!')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --filter=@lifesync/ui -- Toast`
Expected: FAIL — cannot resolve `./Toast`.

- [ ] **Step 3: Implement the component**

`packages/ui/src/components/Toast/Toast.tsx`:

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from '../../utils/cn';
import styles from './Toast.module.css';

type ToastVariant = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const remove = useCallback((id: number) => {
    setItems((curr) => curr.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = nextId.current++;
      setItems((curr) => [...curr, { id, message, variant }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(styles.toast, styles[t.variant])}
            onClick={() => remove(t.id)}
          >
            {t.message}
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

`packages/ui/src/components/Toast/Toast.module.css`:

```css
.region {
  position: fixed;
  bottom: var(--ls-space-4);
  right: var(--ls-space-4);
  z-index: 60;
  display: flex;
  flex-direction: column;
  gap: var(--ls-space-2);
  align-items: flex-end;
}
.toast {
  font: inherit;
  font-size: var(--ls-text-sm);
  text-align: left;
  color: var(--ls-text-inverse);
  background: var(--ls-text-primary);
  border: none;
  border-radius: var(--ls-radius-md);
  padding: var(--ls-space-3) var(--ls-space-4);
  box-shadow: var(--ls-shadow-lg);
  cursor: pointer;
  animation: slide var(--ls-duration-standard) var(--ls-ease-entrance);
}
.success { background: var(--ls-urgency-on-track); }
.error { background: var(--ls-urgency-overdue); }
.info { background: var(--ls-primary-700); }
@keyframes slide {
  from { opacity: 0; transform: translateY(8px); }
}
@media (prefers-reduced-motion: reduce) {
  .toast { animation: none; }
}
```

`packages/ui/src/components/Toast/index.ts`:

```ts
export { ToastProvider, useToast } from './Toast';
```

- [ ] **Step 4: Export from the barrel**

In `packages/ui/src/index.ts` add:

```ts
export { ToastProvider, useToast } from './components/Toast/Toast';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test --filter=@lifesync/ui -- Toast`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): add Toast provider and hook"
```

---

## Task 5: UI — `TaskItem`

**Files:**
- Create: `packages/ui/src/components/TaskItem/TaskItem.tsx`
- Create: `packages/ui/src/components/TaskItem/TaskItem.module.css`
- Create: `packages/ui/src/components/TaskItem/TaskItem.test.tsx`
- Create: `packages/ui/src/components/TaskItem/index.ts`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/ui/src/components/TaskItem/TaskItem.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskItem } from './TaskItem';

const baseTask = {
  id: 't1',
  title: 'Send invitations',
  status: 'pending' as const,
  dueDate: null as string | null,
  ownerName: null as string | null,
};

describe('TaskItem', () => {
  it('renders the task title', () => {
    render(<TaskItem task={baseTask} depth={0} onToggleComplete={() => {}} />);
    expect(screen.getByText('Send invitations')).toBeInTheDocument();
  });

  it('fires onToggleComplete with the id when the checkbox is clicked', async () => {
    const onToggle = vi.fn();
    render(<TaskItem task={baseTask} depth={0} onToggleComplete={onToggle} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /send invitations/i }));
    expect(onToggle).toHaveBeenCalledWith('t1');
  });

  it('marks completed tasks as checked', () => {
    render(
      <TaskItem
        task={{ ...baseTask, status: 'completed' }}
        depth={0}
        onToggleComplete={() => {}}
      />,
    );
    expect(screen.getByRole('checkbox')).toBeChecked();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --filter=@lifesync/ui -- TaskItem`
Expected: FAIL — cannot resolve `./TaskItem`.

- [ ] **Step 3: Implement the component**

`packages/ui/src/components/TaskItem/TaskItem.tsx`:

```tsx
import { cn } from '../../utils/cn';
import { formatRelativeDate } from '../../utils/format-date';
import styles from './TaskItem.module.css';

export interface TaskItemData {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  ownerName: string | null;
}

export interface TaskItemProps {
  task: TaskItemData;
  depth: 0 | 1;
  onToggleComplete: (taskId: string) => void;
}

export function TaskItem({ task, depth, onToggleComplete }: TaskItemProps) {
  const done = task.status === 'completed';
  return (
    <div className={cn(styles.row, depth === 1 && styles.nested)}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={done}
        aria-label={task.title}
        onChange={() => onToggleComplete(task.id)}
      />
      <span className={cn(styles.title, done && styles.done)}>{task.title}</span>
      {task.dueDate ? <span className={styles.due}>{formatRelativeDate(task.dueDate)}</span> : null}
      {task.ownerName ? <span className={styles.owner}>{task.ownerName}</span> : null}
    </div>
  );
}
```

`packages/ui/src/components/TaskItem/TaskItem.module.css`:

```css
.row {
  display: flex;
  align-items: center;
  gap: var(--ls-space-3);
  padding: var(--ls-space-2) 0;
  border-bottom: 1px solid var(--ls-surface-border);
}
.nested {
  padding-left: var(--ls-space-6);
}
.checkbox {
  width: 1.1rem;
  height: 1.1rem;
  accent-color: var(--ls-primary-600);
  flex: none;
}
.title {
  font-size: var(--ls-text-base);
  color: var(--ls-text-primary);
}
.done {
  color: var(--ls-text-tertiary);
  text-decoration: line-through;
}
.due {
  margin-left: auto;
  font-size: var(--ls-text-xs);
  color: var(--ls-text-secondary);
}
.owner {
  font-size: var(--ls-text-xs);
  color: var(--ls-text-tertiary);
}
```

`packages/ui/src/components/TaskItem/index.ts`:

```ts
export { TaskItem, type TaskItemProps, type TaskItemData } from './TaskItem';
```

- [ ] **Step 4: Export from the barrel**

In `packages/ui/src/index.ts` add:

```ts
export {
  TaskItem,
  type TaskItemProps,
  type TaskItemData,
} from './components/TaskItem/TaskItem';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test --filter=@lifesync/ui -- TaskItem`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): add TaskItem component"
```

---

## Task 6: UI — `ProjectCard`

**Files:**
- Create: `packages/ui/src/components/ProjectCard/ProjectCard.tsx`
- Create: `packages/ui/src/components/ProjectCard/ProjectCard.module.css`
- Create: `packages/ui/src/components/ProjectCard/ProjectCard.test.tsx`
- Create: `packages/ui/src/components/ProjectCard/index.ts`
- Modify: `packages/ui/src/index.ts`

ProjectCard is presentational and framework-agnostic: it takes the data it needs (no web icons baked in) plus an optional `icon` node and renders as an `<a>` so Next's `<Link>` can wrap it or it can be used directly.

- [ ] **Step 1: Write the failing test**

`packages/ui/src/components/ProjectCard/ProjectCard.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectCard } from './ProjectCard';

const project = {
  title: 'Mum’s 60th',
  dueDate: '2099-01-01',
  ownerName: 'Jordan',
  taskCount: 4,
  completedCount: 1,
};

describe('ProjectCard', () => {
  it('renders the title and a link to the project', () => {
    render(<ProjectCard project={project} href="/projects/p1" />);
    const link = screen.getByRole('link', { name: /Mum’s 60th/ });
    expect(link).toHaveAttribute('href', '/projects/p1');
  });

  it('shows progress when there are tasks', () => {
    render(<ProjectCard project={project} href="/projects/p1" />);
    expect(screen.getByText('1/4')).toBeInTheDocument();
  });

  it('shows "No tasks" when the project has none', () => {
    render(
      <ProjectCard project={{ ...project, taskCount: 0, completedCount: 0 }} href="/projects/p1" />,
    );
    expect(screen.getByText('No tasks')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --filter=@lifesync/ui -- ProjectCard`
Expected: FAIL — cannot resolve `./ProjectCard`.

- [ ] **Step 3: Implement the component**

`packages/ui/src/components/ProjectCard/ProjectCard.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { formatRelativeDate, daysUntil } from '../../utils/format-date';
import { urgencyStyle, urgencyFromDays } from '../../utils/urgency-color';
import styles from './ProjectCard.module.css';

export interface ProjectCardData {
  title: string;
  dueDate: string | null;
  ownerName: string | null;
  taskCount: number;
  completedCount: number;
}

export interface ProjectCardProps {
  project: ProjectCardData;
  href: string;
  icon?: ReactNode;
}

export function ProjectCard({ project, href, icon }: ProjectCardProps) {
  const { title, dueDate, ownerName, taskCount, completedCount } = project;
  const urgency = urgencyStyle(urgencyFromDays(daysUntil(dueDate)));
  const pct = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;

  return (
    <a className={styles.card} href={href}>
      <div className={styles.head}>
        {icon ? (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className={styles.title}>{title}</span>
      </div>

      <div className={styles.meta}>
        {dueDate ? (
          <span
            className={styles.due}
            style={{ color: urgency.color, background: urgency.soft }}
          >
            {formatRelativeDate(dueDate)}
          </span>
        ) : null}
        {ownerName ? <span className={styles.owner}>{ownerName}</span> : null}
      </div>

      {taskCount > 0 ? (
        <div className={styles.progress}>
          <div className={styles.track}>
            <div className={cn(styles.fill)} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.count}>
            {completedCount}/{taskCount}
          </span>
        </div>
      ) : (
        <span className={styles.noTasks}>No tasks</span>
      )}
    </a>
  );
}
```

`packages/ui/src/components/ProjectCard/ProjectCard.module.css`:

```css
.card {
  display: flex;
  flex-direction: column;
  gap: var(--ls-space-2);
  padding: var(--ls-space-4);
  background: var(--ls-surface-card);
  border: 1px solid var(--ls-surface-border);
  border-radius: var(--ls-radius-lg);
  text-decoration: none;
  transition: box-shadow var(--ls-duration-micro) var(--ls-ease-standard),
    transform var(--ls-duration-micro) var(--ls-ease-standard);
}
.card:hover {
  box-shadow: var(--ls-shadow-md);
  transform: translateY(-1px);
}
.head {
  display: flex;
  align-items: center;
  gap: var(--ls-space-2);
}
.icon {
  color: var(--ls-primary-700);
  display: inline-flex;
}
.title {
  font-weight: 600;
  color: var(--ls-text-primary);
}
.meta {
  display: flex;
  align-items: center;
  gap: var(--ls-space-2);
}
.due {
  font-size: var(--ls-text-xs);
  padding: 2px var(--ls-space-2);
  border-radius: var(--ls-radius-full);
}
.owner {
  font-size: var(--ls-text-xs);
  color: var(--ls-text-tertiary);
}
.progress {
  display: flex;
  align-items: center;
  gap: var(--ls-space-2);
}
.track {
  flex: 1;
  height: 5px;
  background: var(--ls-surface-sunken);
  border-radius: var(--ls-radius-full);
  overflow: hidden;
}
.fill {
  height: 100%;
  background: var(--ls-primary-500);
}
.count {
  font-size: var(--ls-text-xs);
  color: var(--ls-text-secondary);
}
.noTasks {
  font-size: var(--ls-text-xs);
  color: var(--ls-text-tertiary);
}
```

`packages/ui/src/components/ProjectCard/index.ts`:

```ts
export { ProjectCard, type ProjectCardProps, type ProjectCardData } from './ProjectCard';
```

- [ ] **Step 4: Export from the barrel**

In `packages/ui/src/index.ts` add:

```ts
export {
  ProjectCard,
  type ProjectCardProps,
  type ProjectCardData,
} from './components/ProjectCard/ProjectCard';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm test --filter=@lifesync/ui -- ProjectCard`
Expected: PASS (3 tests). Then run `pnpm test --filter=@lifesync/ui` to confirm the whole UI suite is green.

- [ ] **Step 6: Commit**

```bash
git add packages/ui
git commit -m "feat(ui): add ProjectCard component"
```

---

## Task 7: Web — type icons + project-type registry

**Files:**
- Modify: `apps/web/src/components/icons.tsx`
- Create: `apps/web/src/lib/projects/project-meta.tsx`
- Create: `apps/web/src/lib/projects/field-registry.ts`

- [ ] **Step 1: Add four project-type icons**

Append to `apps/web/src/components/icons.tsx` (they follow the existing `Icon` wrapper pattern already in the file):

```tsx
export const ShieldIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 5 6v6c0 4 3 6.5 7 9 4-2.5 7-5 7-9V6l-7-3Z" />
  </Icon>
);

export const PlaneIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.5 13.5 3 12l8-5 2-4 1.5 1L13 8l5 1.5L21 8l1 1-3 3 1 6-2 1-3-5-3 5-2-1 1-4.5Z" />
  </Icon>
);

export const StethoscopeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 3v5a4 4 0 0 0 8 0V3" />
    <path d="M9 14a6 6 0 0 0 6 6 4 4 0 0 0 4-4v-2" />
    <circle cx="19" cy="11" r="2" />
  </Icon>
);

export const CompassIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
  </Icon>
);
```

- [ ] **Step 2: Create the project-type meta map**

`apps/web/src/lib/projects/project-meta.tsx`:

```tsx
import type { ReactNode } from 'react';
import type { ProjectType } from '@lifesync/shared-types';
import {
  GiftIcon,
  ShieldIcon,
  HouseholdIcon,
  StethoscopeIcon,
  PlaneIcon,
  CompassIcon,
  ProjectsIcon,
} from '@/components/icons';

export interface ProjectTypeMeta {
  label: string;
  icon: ReactNode;
}

/** Display order for the grouped Projects list and the type select. */
export const PROJECT_TYPE_ORDER: ProjectType[] = [
  'occasion',
  'compliance',
  'household',
  'health',
  'travel',
  'planning',
  'general',
];

export const PROJECT_TYPE_META: Record<ProjectType, ProjectTypeMeta> = {
  occasion: { label: 'Occasions', icon: <GiftIcon /> },
  compliance: { label: 'Compliance', icon: <ShieldIcon /> },
  household: { label: 'Household', icon: <HouseholdIcon /> },
  health: { label: 'Health', icon: <StethoscopeIcon /> },
  travel: { label: 'Travel', icon: <PlaneIcon /> },
  planning: { label: 'Planning', icon: <CompassIcon /> },
  general: { label: 'General', icon: <ProjectsIcon /> },
};
```

- [ ] **Step 3: Create the per-type custom-field registry**

`apps/web/src/lib/projects/field-registry.ts`:

```ts
import type { ProjectType } from '@lifesync/shared-types';

export type FieldKind = 'text' | 'number' | 'date' | 'boolean' | 'string-list';

export interface ProjectFieldDef {
  /** Key written into `customFields`. */
  key: string;
  label: string;
  kind: FieldKind;
}

/**
 * Maps each project type to its editable custom fields. Keys match the
 * `*Fields` interfaces in @lifesync/shared-types (snake_case).
 * `string-list` fields are entered as comma-separated values and stored as
 * `string[]`. `general` has no extra fields.
 */
export const PROJECT_FIELD_REGISTRY: Record<ProjectType, ProjectFieldDef[]> = {
  occasion: [
    { key: 'event_date', label: 'Event date', kind: 'date' },
    { key: 'gift_budget', label: 'Gift budget', kind: 'number' },
    { key: 'venue', label: 'Venue', kind: 'text' },
    { key: 'gift_ideas', label: 'Gift ideas', kind: 'string-list' },
    { key: 'recurring_annually', label: 'Recurs annually', kind: 'boolean' },
  ],
  compliance: [
    { key: 'document_type', label: 'Document type', kind: 'text' },
    { key: 'issuing_authority', label: 'Issuing authority', kind: 'text' },
    { key: 'reference_number', label: 'Reference number', kind: 'text' },
    { key: 'renewal_date', label: 'Renewal date', kind: 'date' },
    { key: 'lead_time_days', label: 'Lead time (days)', kind: 'number' },
  ],
  household: [
    { key: 'area', label: 'Area', kind: 'text' },
    { key: 'frequency', label: 'Frequency', kind: 'text' },
    { key: 'last_completed', label: 'Last completed', kind: 'date' },
    { key: 'supplies_needed', label: 'Supplies needed', kind: 'string-list' },
  ],
  health: [
    { key: 'provider', label: 'Provider', kind: 'text' },
    { key: 'appointment_type', label: 'Appointment type', kind: 'text' },
    { key: 'medication', label: 'Medication', kind: 'text' },
    { key: 'next_followup', label: 'Next follow-up', kind: 'date' },
  ],
  travel: [
    { key: 'destination', label: 'Destination', kind: 'text' },
    { key: 'departure_date', label: 'Departure date', kind: 'date' },
    { key: 'return_date', label: 'Return date', kind: 'date' },
    { key: 'visa_required', label: 'Visa required', kind: 'boolean' },
    { key: 'packing_list', label: 'Packing list', kind: 'string-list' },
  ],
  planning: [
    { key: 'budget', label: 'Budget', kind: 'number' },
    { key: 'decision_deadline', label: 'Decision deadline', kind: 'date' },
    { key: 'options_considered', label: 'Options considered', kind: 'string-list' },
  ],
  general: [],
};
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (no usages yet, but imports resolve).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/icons.tsx apps/web/src/lib/projects
git commit -m "feat(web): add project-type icons, meta, and field registry"
```

---

## Task 8: Web — `/projects` list page (grouped by type)

**Files:**
- Create: `apps/web/src/app/(app)/projects/page.tsx`
- Create: `apps/web/src/app/(app)/projects/projects.module.css`
- Create: `apps/web/src/app/(app)/projects/loading.tsx`
- Create: `apps/web/src/app/(app)/projects/page.test.tsx`

This task builds the page with the **New project** button present but wired to a no-op `onClick` placeholder that opens local state; the actual `ProjectForm` is connected in Task 11 (the form component is built in Task 9). To keep this task self-contained, the button toggles a `showForm` boolean that, for now, renders nothing when true. Task 11 replaces that branch with `<ProjectForm>`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/app/(app)/projects/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ project: { list: { invalidate: vi.fn() } } }),
    project: {
      list: {
        useQuery: () => ({
          isLoading: false,
          isError: false,
          data: [
            {
              id: 'p1',
              type: 'occasion',
              title: 'Mum’s 60th',
              dueDate: '2099-01-01',
              ownerId: null,
              status: 'active',
              taskCount: 2,
              completedCount: 1,
            },
            {
              id: 'p2',
              type: 'travel',
              title: 'Japan trip',
              dueDate: null,
              ownerId: null,
              status: 'active',
              taskCount: 0,
              completedCount: 0,
            },
          ],
        }),
      },
    },
  },
}));

import ProjectsPage from './page';

describe('ProjectsPage', () => {
  it('groups projects under their type headings', () => {
    render(<ProjectsPage />);
    expect(screen.getByRole('heading', { name: /Occasions/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Travel/ })).toBeInTheDocument();
    expect(screen.getByText('Mum’s 60th')).toBeInTheDocument();
    expect(screen.getByText('Japan trip')).toBeInTheDocument();
  });

  it('omits type sections that have no projects', () => {
    render(<ProjectsPage />);
    expect(screen.queryByRole('heading', { name: /Compliance/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --filter=web -- projects/page`
Expected: FAIL — cannot resolve `./page`.

- [ ] **Step 3: Implement the page**

`apps/web/src/app/(app)/projects/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { Button, EmptyState, LoadingSpinner, ProjectCard } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { PROJECT_TYPE_META, PROJECT_TYPE_ORDER } from '@/lib/projects/project-meta';
import { PlusIcon } from '@/components/icons';
import styles from './projects.module.css';

type ProjectListItem = inferRouterOutputs<AppRouter>['project']['list'][number];

export default function ProjectsPage() {
  const workspaceId = useWorkspaceId();
  const enabled = Boolean(workspaceId);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const query = trpc.project.list.useQuery(
    { workspaceId: workspaceId ?? '', ...(showActiveOnly ? { status: 'active' as const } : {}) },
    { enabled },
  );

  const grouped = (items: ProjectListItem[]) =>
    PROJECT_TYPE_ORDER.map((type) => ({
      type,
      meta: PROJECT_TYPE_META[type],
      projects: items.filter((p) => p.type === type),
    })).filter((g) => g.projects.length > 0);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.heading}>Projects</h1>
          <p className={styles.subhead}>Everything you&rsquo;re working on, by type.</p>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.filter}
            onClick={() => setShowActiveOnly((v) => !v)}
            type="button"
          >
            {showActiveOnly ? 'Active' : 'All'}
          </button>
          <Button size="sm" leadingIcon={<PlusIcon size={16} />} onClick={() => setShowForm(true)}>
            New project
          </Button>
        </div>
      </header>

      {query.isLoading ? (
        <div className={styles.center}>
          <LoadingSpinner size="lg" label="Loading your projects" />
        </div>
      ) : query.isError || !query.data ? (
        <div className={styles.center}>
          <EmptyState
            title="We couldn't load your projects"
            description={
              workspaceId ? 'Make sure the API is running.' : 'No workspace is configured yet.'
            }
          />
        </div>
      ) : query.data.length === 0 ? (
        <div className={styles.center}>
          <EmptyState
            title="No projects yet"
            description="Start one with the New project button."
          />
        </div>
      ) : (
        <div className={styles.groups}>
          {grouped(query.data).map((group) => (
            <section key={group.type} className={styles.group}>
              <h2 className={styles.groupHead}>
                <span className={styles.groupIcon} aria-hidden="true">
                  {group.meta.icon}
                </span>
                {group.meta.label}
                <span className={styles.groupCount}>{group.projects.length}</span>
              </h2>
              <div className={styles.grid}>
                {group.projects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    href={`/projects/${p.id}`}
                    icon={group.meta.icon}
                    project={{
                      title: p.title,
                      dueDate: p.dueDate,
                      ownerName: null,
                      taskCount: p.taskCount,
                      completedCount: p.completedCount,
                    }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Task 11 replaces this with <ProjectForm mode="create" … /> */}
      {showForm ? null : null}
    </div>
  );
}
```

`apps/web/src/app/(app)/projects/projects.module.css`:

```css
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--ls-space-6) var(--ls-space-4) var(--ls-space-16);
}
.head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--ls-space-4);
  margin-bottom: var(--ls-space-6);
}
.heading {
  font-family: var(--ls-font-display);
  font-size: var(--ls-text-3xl);
  margin: 0;
  color: var(--ls-text-primary);
}
.subhead {
  color: var(--ls-text-secondary);
  margin: var(--ls-space-1) 0 0;
}
.actions {
  display: flex;
  align-items: center;
  gap: var(--ls-space-2);
}
.filter {
  font: inherit;
  font-size: var(--ls-text-sm);
  padding: var(--ls-space-2) var(--ls-space-3);
  background: var(--ls-surface-card);
  border: 1px solid var(--ls-surface-border);
  border-radius: var(--ls-radius-full);
  color: var(--ls-text-secondary);
  cursor: pointer;
}
.center {
  display: flex;
  justify-content: center;
  padding: var(--ls-space-16) 0;
}
.groups {
  display: flex;
  flex-direction: column;
  gap: var(--ls-space-8);
}
.groupHead {
  display: flex;
  align-items: center;
  gap: var(--ls-space-2);
  font-size: var(--ls-text-sm);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ls-text-tertiary);
  margin: 0 0 var(--ls-space-3);
}
.groupIcon {
  display: inline-flex;
  color: var(--ls-primary-700);
}
.groupCount {
  color: var(--ls-text-tertiary);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: var(--ls-space-3);
}
```

`apps/web/src/app/(app)/projects/loading.tsx`:

```tsx
import { LoadingSpinner } from '@lifesync/ui';

export default function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
      <LoadingSpinner size="lg" label="Loading your projects" />
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test --filter=web -- projects/page`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/(app)/projects
git commit -m "feat(web): add Projects list page grouped by type"
```

---

## Task 9: Web — `ProjectForm` (create/edit, template picker, per-type fields)

**Files:**
- Create: `apps/web/src/components/projects/ProjectForm.tsx`
- Create: `apps/web/src/components/projects/ProjectForm.module.css`
- Create: `apps/web/src/components/projects/ProjectForm.test.tsx`

`ProjectForm` renders inside `Modal`. It owns local form state, renders core fields + the per-type fields from the registry, and calls `project.create` or `project.update`. On success it fires a Toast and calls `onClose`. It serializes `string-list` fields (comma-separated → `string[]`) and number fields into `customFields`.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/projects/ProjectForm.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ project: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } } }),
    template: { list: { useQuery: () => ({ data: [] }) } },
    workspace: { members: { useQuery: () => ({ data: [] }) } },
    project: {
      create: { useMutation: (o: { onSuccess?: (d: unknown) => void }) => ({ mutate: () => o.onSuccess?.({ id: 'p9' }), isPending: false }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import { ProjectForm } from './ProjectForm';

function renderForm() {
  return render(
    <ToastProvider>
      <ProjectForm mode="create" isOpen onClose={() => {}} />
    </ToastProvider>,
  );
}

describe('ProjectForm', () => {
  it('shows core fields', () => {
    renderForm();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Type')).toBeInTheDocument();
  });

  it('renders per-type fields when the type changes to Travel', async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'travel');
    expect(screen.getByLabelText('Destination')).toBeInTheDocument();
    expect(screen.getByLabelText('Departure date')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --filter=web -- ProjectForm`
Expected: FAIL — cannot resolve `./ProjectForm`.

- [ ] **Step 3: Implement the component**

`apps/web/src/components/projects/ProjectForm.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import type { ProjectType } from '@lifesync/shared-types';
import { Button, Input, Modal, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { PROJECT_TYPE_META, PROJECT_TYPE_ORDER } from '@/lib/projects/project-meta';
import { PROJECT_FIELD_REGISTRY, type ProjectFieldDef } from '@/lib/projects/field-registry';
import styles from './ProjectForm.module.css';

type ProjectDetail = inferRouterOutputs<AppRouter>['project']['get'];

export interface ProjectFormProps {
  mode: 'create' | 'edit';
  isOpen: boolean;
  onClose: () => void;
  project?: ProjectDetail;
}

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];
const VISIBILITIES = [
  { value: 'shared', label: 'Shared' },
  { value: 'mine_visible', label: 'Visible to partner' },
  { value: 'private', label: 'Private' },
];

function customToString(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (value == null) return '';
  return String(value);
}

function serializeCustom(
  defs: ProjectFieldDef[],
  raw: Record<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const def of defs) {
    const v = raw[def.key];
    if (v == null || v === '') continue;
    if (def.kind === 'string-list') out[def.key] = v.split(',').map((s) => s.trim()).filter(Boolean);
    else if (def.kind === 'number') out[def.key] = Number(v);
    else if (def.kind === 'boolean') out[def.key] = v === 'true';
    else out[def.key] = v;
  }
  return out;
}

export function ProjectForm({ mode, isOpen, onClose, project }: ProjectFormProps) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [type, setType] = useState<ProjectType>(project?.type ?? 'general');
  const [title, setTitle] = useState(project?.title ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [dueDate, setDueDate] = useState(project?.dueDate ?? '');
  const [priority, setPriority] = useState(project?.priority ?? 'medium');
  const [visibility, setVisibility] = useState(project?.visibility ?? 'shared');
  const [templateId, setTemplateId] = useState('');
  const [custom, setCustom] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (project) {
      for (const def of PROJECT_FIELD_REGISTRY[project.type]) {
        init[def.key] = customToString((project.customFields as Record<string, unknown>)[def.key]);
      }
    }
    return init;
  });

  const templates = trpc.template.list.useQuery(
    { workspaceId: workspaceId ?? '', type },
    { enabled: mode === 'create' && Boolean(workspaceId) },
  );

  const fieldDefs = PROJECT_FIELD_REGISTRY[type];

  const onDone = () => {
    if (workspaceId) void utils.project.list.invalidate({ workspaceId });
    if (project) void utils.project.get.invalidate({ id: project.id });
    toast.success(mode === 'create' ? 'Project created' : 'Project updated');
    onClose();
  };

  const create = trpc.project.create.useMutation({ onSuccess: onDone });
  const update = trpc.project.update.useMutation({ onSuccess: onDone });
  const busy = create.isPending || update.isPending;

  const submit = () => {
    if (!title.trim() || busy) return;
    const customFields = serializeCustom(fieldDefs, custom);
    if (mode === 'create') {
      if (!workspaceId) return;
      create.mutate({
        workspaceId,
        type,
        title: title.trim(),
        description: description || undefined,
        dueDate: dueDate || undefined,
        priority: priority as never,
        visibility: visibility as never,
        templateId: templateId || undefined,
        customFields,
      });
    } else if (project) {
      update.mutate({
        id: project.id,
        title: title.trim(),
        description: description || null,
        dueDate: dueDate || null,
        priority: priority as never,
        visibility: visibility as never,
        customFields,
      });
    }
  };

  const typeOptions = useMemo(
    () => PROJECT_TYPE_ORDER.map((t) => ({ value: t, label: PROJECT_TYPE_META[t].label })),
    [],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'New project' : 'Edit project'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim() || busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        {mode === 'create' && (templates.data?.length ?? 0) > 0 ? (
          <Input
            as="select"
            label="Start from template"
            value={templateId}
            onChange={setTemplateId}
            options={[
              { value: '', label: 'Blank project' },
              ...(templates.data ?? []).map((t) => ({ value: t.id, label: t.name })),
            ]}
          />
        ) : null}

        {mode === 'create' ? (
          <Input
            as="select"
            label="Type"
            value={type}
            onChange={(v) => setType(v as ProjectType)}
            options={typeOptions}
          />
        ) : null}

        <Input label="Title" value={title} onChange={setTitle} required />
        <Input as="textarea" label="Description" value={description} onChange={setDescription} />
        <Input type="date" label="Due date" value={dueDate} onChange={setDueDate} />
        <Input as="select" label="Priority" value={priority} onChange={setPriority} options={PRIORITIES} />
        <Input as="select" label="Visibility" value={visibility} onChange={setVisibility} options={VISIBILITIES} />

        {fieldDefs.length > 0 ? (
          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>{PROJECT_TYPE_META[type].label} details</legend>
            {fieldDefs.map((def) => {
              const value = custom[def.key] ?? '';
              const set = (v: string) => setCustom((c) => ({ ...c, [def.key]: v }));
              if (def.kind === 'boolean') {
                return (
                  <Input
                    key={def.key}
                    as="select"
                    label={def.label}
                    value={value || 'false'}
                    onChange={set}
                    options={[
                      { value: 'false', label: 'No' },
                      { value: 'true', label: 'Yes' },
                    ]}
                  />
                );
              }
              return (
                <Input
                  key={def.key}
                  label={def.label}
                  value={value}
                  onChange={set}
                  type={def.kind === 'number' ? 'number' : def.kind === 'date' ? 'date' : 'text'}
                  helperText={def.kind === 'string-list' ? 'Comma-separated' : undefined}
                />
              );
            })}
          </fieldset>
        ) : null}
      </div>
    </Modal>
  );
}
```

`apps/web/src/components/projects/ProjectForm.module.css`:

```css
.form {
  display: flex;
  flex-direction: column;
  gap: var(--ls-space-3);
}
.fieldset {
  display: flex;
  flex-direction: column;
  gap: var(--ls-space-3);
  border: 1px solid var(--ls-surface-border);
  border-radius: var(--ls-radius-md);
  padding: var(--ls-space-3);
  margin: 0;
}
.legend {
  font-size: var(--ls-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ls-text-tertiary);
  padding: 0 var(--ls-space-2);
}
```

> Note on `priority as never` / `visibility as never`: the tRPC input types are string-literal unions. The select values are constrained by the option lists above, so the cast is safe; if `pnpm typecheck` prefers, replace with the concrete union imports `Priority` / `Visibility` from `@lifesync/shared-types` and type the `useState` generics accordingly.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test --filter=web -- ProjectForm`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/projects
git commit -m "feat(web): add ProjectForm with template picker and per-type fields"
```

---

## Task 10: Web — `/projects/[id]` detail page (single column)

**Files:**
- Create: `apps/web/src/app/(app)/projects/[id]/page.tsx`
- Create: `apps/web/src/app/(app)/projects/[id]/project-detail.module.css`
- Create: `apps/web/src/app/(app)/projects/[id]/page.test.tsx`

The detail page reads `project.get` (project + nested task tree), renders the header/actions, progress, the type-specific details strip (read view from the registry), and the task list (one subtask level) with inline complete and add-task. Edit/create modals are wired in Task 11; here the Edit button toggles local state with no modal yet.

- [ ] **Step 1: Write the failing test**

`apps/web/src/app/(app)/projects/[id]/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const completeMutate = vi.fn();

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'p1' }) }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ project: { get: { invalidate: vi.fn() } } }),
    project: {
      get: {
        useQuery: () => ({
          isLoading: false,
          isError: false,
          data: {
            id: 'p1',
            type: 'occasion',
            title: 'Mum’s 60th',
            description: 'Surprise dinner',
            dueDate: '2099-01-01',
            priority: 'medium',
            visibility: 'shared',
            ownerId: null,
            customFields: { venue: 'The Ivy' },
            tasks: [
              { id: 't1', title: 'Book restaurant', status: 'completed', dueDate: null, ownerId: null, children: [] },
              { id: 't2', title: 'Send invites', status: 'pending', dueDate: null, ownerId: null, children: [] },
            ],
          },
        }),
      },
      complete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      archive: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    task: {
      complete: { useMutation: (o: { onSuccess?: () => void }) => ({ mutate: (v: unknown) => { completeMutate(v); o.onSuccess?.(); }, isPending: false }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import ProjectDetailPage from './page';

describe('ProjectDetailPage', () => {
  it('renders the project title and its tasks', () => {
    render(<ProjectDetailPage />);
    expect(screen.getByRole('heading', { name: /Mum’s 60th/ })).toBeInTheDocument();
    expect(screen.getByText('Book restaurant')).toBeInTheDocument();
    expect(screen.getByText('Send invites')).toBeInTheDocument();
  });

  it('completes a task when its checkbox is toggled', async () => {
    render(<ProjectDetailPage />);
    await userEvent.click(screen.getByRole('checkbox', { name: /send invites/i }));
    expect(completeMutate).toHaveBeenCalledWith({ id: 't2' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test --filter=web -- "projects/\[id\]/page"`
Expected: FAIL — cannot resolve `./page`.

- [ ] **Step 3: Implement the page**

`apps/web/src/app/(app)/projects/[id]/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { Button, EmptyState, LoadingSpinner, TaskItem } from '@lifesync/ui';
import { formatRelativeDate } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { PROJECT_TYPE_META } from '@/lib/projects/project-meta';
import { PROJECT_FIELD_REGISTRY } from '@/lib/projects/field-registry';
import styles from './project-detail.module.css';

type ProjectDetail = inferRouterOutputs<AppRouter>['project']['get'];
type TaskNode = ProjectDetail['tasks'][number];

function countTasks(nodes: TaskNode[]): { total: number; done: number } {
  let total = 0;
  let done = 0;
  const walk = (list: TaskNode[]) => {
    for (const n of list) {
      total += 1;
      if (n.status === 'completed') done += 1;
      if (n.children?.length) walk(n.children);
    }
  };
  walk(nodes);
  return { total, done };
}

function fieldDisplay(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (value == null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const utils = trpc.useUtils();
  const [newTask, setNewTask] = useState('');

  const query = trpc.project.get.useQuery({ id }, { enabled: Boolean(id) });

  const refresh = () => void utils.project.get.invalidate({ id });
  const completeTask = trpc.task.complete.useMutation({ onSuccess: refresh });
  const createTask = trpc.task.create.useMutation({
    onSuccess: () => {
      setNewTask('');
      refresh();
    },
  });
  const completeProject = trpc.project.complete.useMutation({ onSuccess: refresh });
  const archiveProject = trpc.project.archive.useMutation({ onSuccess: refresh });

  if (query.isLoading) {
    return (
      <div className={styles.center}>
        <LoadingSpinner size="lg" label="Loading project" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className={styles.center}>
        <EmptyState
          title="Project not found"
          description="It may have been removed, or you don't have access to it."
        />
      </div>
    );
  }

  const project = query.data;
  const meta = PROJECT_TYPE_META[project.type];
  const { total, done } = countTasks(project.tasks);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const fieldDefs = PROJECT_FIELD_REGISTRY[project.type];
  const cf = project.customFields as Record<string, unknown>;

  const addTask = () => {
    const value = newTask.trim();
    if (!value || createTask.isPending) return;
    createTask.mutate({ projectId: project.id, title: value });
  };

  return (
    <div className={styles.page}>
      <Link href="/projects" className={styles.back}>
        ← Projects
      </Link>

      <header className={styles.head}>
        <h1 className={styles.title}>
          <span className={styles.icon} aria-hidden="true">
            {meta.icon}
          </span>
          {project.title}
        </h1>
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" onClick={() => archiveProject.mutate({ id: project.id })}>
            Archive
          </Button>
          <Button size="sm" onClick={() => completeProject.mutate({ id: project.id })}>
            Complete
          </Button>
        </div>
      </header>

      <div className={styles.metaRow}>
        <span className={styles.metaPill}>{meta.label}</span>
        {project.dueDate ? (
          <span className={styles.metaPill}>{formatRelativeDate(project.dueDate)}</span>
        ) : null}
      </div>

      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>

      {fieldDefs.length > 0 ? (
        <section className={styles.details}>
          {fieldDefs.map((def) => (
            <div key={def.key} className={styles.detail}>
              <span className={styles.detailLabel}>{def.label}</span>
              <span className={styles.detailValue}>{fieldDisplay(cf[def.key])}</span>
            </div>
          ))}
        </section>
      ) : null}

      {project.description ? <p className={styles.description}>{project.description}</p> : null}

      <section className={styles.tasks}>
        <h2 className={styles.tasksHead}>
          Tasks
          <span className={styles.tasksCount}>
            {done} of {total}
          </span>
        </h2>

        {project.tasks.map((task) => (
          <div key={task.id}>
            <TaskItem
              task={{
                id: task.id,
                title: task.title,
                status: task.status,
                dueDate: task.dueDate,
                ownerName: null,
              }}
              depth={0}
              onToggleComplete={(taskId) => completeTask.mutate({ id: taskId })}
            />
            {(task.children ?? []).map((child) => (
              <TaskItem
                key={child.id}
                task={{
                  id: child.id,
                  title: child.title,
                  status: child.status,
                  dueDate: child.dueDate,
                  ownerName: null,
                }}
                depth={1}
                onToggleComplete={(taskId) => completeTask.mutate({ id: taskId })}
              />
            ))}
          </div>
        ))}

        <form
          className={styles.addRow}
          onSubmit={(e) => {
            e.preventDefault();
            addTask();
          }}
        >
          <input
            className={styles.addInput}
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Add a task…"
            aria-label="Add a task"
          />
          <Button type="submit" size="sm" variant="secondary" disabled={!newTask.trim()}>
            Add
          </Button>
        </form>
      </section>
    </div>
  );
}
```

`apps/web/src/app/(app)/projects/[id]/project-detail.module.css`:

```css
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--ls-space-6) var(--ls-space-4) var(--ls-space-16);
}
.center {
  display: flex;
  justify-content: center;
  padding: var(--ls-space-16) 0;
}
.back {
  display: inline-block;
  font-size: var(--ls-text-sm);
  color: var(--ls-text-tertiary);
  text-decoration: none;
  margin-bottom: var(--ls-space-4);
}
.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--ls-space-4);
}
.title {
  display: flex;
  align-items: center;
  gap: var(--ls-space-2);
  font-family: var(--ls-font-display);
  font-size: var(--ls-text-2xl);
  margin: 0;
  color: var(--ls-text-primary);
}
.icon {
  display: inline-flex;
  color: var(--ls-primary-700);
}
.actions {
  display: flex;
  gap: var(--ls-space-2);
  flex: none;
}
.metaRow {
  display: flex;
  gap: var(--ls-space-2);
  margin: var(--ls-space-3) 0;
}
.metaPill {
  font-size: var(--ls-text-xs);
  padding: 2px var(--ls-space-2);
  border-radius: var(--ls-radius-full);
  background: var(--ls-surface-sunken);
  color: var(--ls-text-secondary);
}
.track {
  height: 6px;
  background: var(--ls-surface-sunken);
  border-radius: var(--ls-radius-full);
  overflow: hidden;
  margin-bottom: var(--ls-space-5);
}
.fill {
  height: 100%;
  background: var(--ls-primary-500);
}
.details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--ls-space-3);
  padding: var(--ls-space-4);
  background: var(--ls-surface-card);
  border: 1px solid var(--ls-surface-border);
  border-radius: var(--ls-radius-lg);
  margin-bottom: var(--ls-space-4);
}
.detail {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.detailLabel {
  font-size: var(--ls-text-xs);
  color: var(--ls-text-tertiary);
}
.detailValue {
  font-size: var(--ls-text-sm);
  color: var(--ls-text-primary);
}
.description {
  color: var(--ls-text-secondary);
  margin: 0 0 var(--ls-space-5);
}
.tasksHead {
  display: flex;
  align-items: baseline;
  gap: var(--ls-space-2);
  font-size: var(--ls-text-lg);
  color: var(--ls-text-primary);
  margin: 0 0 var(--ls-space-2);
}
.tasksCount {
  font-size: var(--ls-text-sm);
  color: var(--ls-text-tertiary);
}
.addRow {
  display: flex;
  gap: var(--ls-space-2);
  margin-top: var(--ls-space-3);
}
.addInput {
  flex: 1;
  font: inherit;
  font-size: var(--ls-text-base);
  padding: var(--ls-space-2) var(--ls-space-3);
  background: var(--ls-surface-elevated);
  border: 1px solid var(--ls-surface-border-strong);
  border-radius: var(--ls-radius-md);
}
.addInput:focus {
  outline: none;
  border-color: var(--ls-primary-500);
  box-shadow: var(--ls-shadow-focus);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test --filter=web -- "projects/\[id\]/page"`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/projects/[id]"
git commit -m "feat(web): add Project detail page with task list"
```

---

## Task 11: Web — wire ToastProvider + connect ProjectForm to both pages

**Files:**
- Modify: `apps/web/src/lib/providers.tsx`
- Modify: `apps/web/src/app/(app)/projects/page.tsx`
- Modify: `apps/web/src/app/(app)/projects/[id]/page.tsx`

- [ ] **Step 1: Mount the ToastProvider**

In `apps/web/src/lib/providers.tsx`, import and wrap. Add `import { ToastProvider } from '@lifesync/ui';` and change the `Providers` return to nest it inside `TRPCProvider` (so toasts can sit above app content but inside the query/clerk context):

```tsx
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <TRPCProvider>
        <ToastProvider>{children}</ToastProvider>
      </TRPCProvider>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Connect the create form on the list page**

In `apps/web/src/app/(app)/projects/page.tsx`, add the import `import { ProjectForm } from '@/components/projects/ProjectForm';` and replace the placeholder block

```tsx
      {/* Task 11 replaces this with <ProjectForm mode="create" … /> */}
      {showForm ? null : null}
```

with:

```tsx
      <ProjectForm mode="create" isOpen={showForm} onClose={() => setShowForm(false)} />
```

- [ ] **Step 3: Connect the edit form on the detail page**

In `apps/web/src/app/(app)/projects/[id]/page.tsx`:
1. Add the import `import { ProjectForm } from '@/components/projects/ProjectForm';`.
2. Add edit state near the other `useState`: `const [editing, setEditing] = useState(false);`.
3. Add an Edit button in the `.actions` group, before Archive:

```tsx
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
```

4. Before the final closing `</div>` of the page, add:

```tsx
      <ProjectForm
        mode="edit"
        isOpen={editing}
        onClose={() => setEditing(false)}
        project={project}
      />
```

- [ ] **Step 4: Run the affected tests**

Run: `pnpm test --filter=web`
Expected: PASS — existing projects tests still green (the create form is closed by default, so the list test's DOM is unchanged; the detail test doesn't open the edit modal).

- [ ] **Step 5: Typecheck the whole repo**

Run: `pnpm typecheck`
Expected: PASS. If the `as never` casts in `ProjectForm` are rejected, apply the typed-union fallback noted in Task 9, Step 3.

- [ ] **Step 6: Full suite + commit**

```bash
pnpm test
```
Expected: all packages green (api, web, ui counts increased by the new tests; mobile still passWithNoTests).

```bash
git add apps/web/src/lib/providers.tsx "apps/web/src/app/(app)/projects"
git commit -m "feat(web): wire ToastProvider and connect ProjectForm to project pages"
```

---

## Task 12: Manual verification + docs update

**Files:**
- Modify: `CLAUDE.md` (Development Status section)

- [ ] **Step 1: Manual smoke test**

Start the apps: `pnpm dev --filter=api` and `pnpm dev --filter=web`. In the browser:
1. Visit `/projects` — confirm projects appear grouped by type with progress bars (no more 404).
2. Click **New project**, pick Travel, confirm Destination/Departure fields appear, save → success toast, card appears.
3. Open a project — toggle a task complete (progress moves), add a task, edit the project.
Confirm no console errors.

- [ ] **Step 2: Update the status doc**

In `CLAUDE.md`, update the **Done ✅** and **Remaining 🔭** sections: move Projects list + detail and the five UI components (Input, Modal, Toast, TaskItem, ProjectCard) into Done; in Remaining item 1, strike Projects from the screen list and note ProjectCard/TaskItem/Input/Modal/Toast are now built. Update the "Last updated" date to 2026-06-12 and refresh the test count after running `pnpm test`.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Projects slice A complete in status"
```

---

## Self-Review Notes (addressed)

- **Spec coverage:** backend counts (Task 1), all five components (Tasks 2–6), list page grouped by type + progress (Task 8), detail single-column with one subtask level (Task 10), template picker + per-type fields create/edit (Task 9), Toast wiring + data invalidation (Task 11), tests at every layer, status doc (Task 12). Out-of-scope items (resources, reminders UI, drag-reorder, deep nesting, person links) are intentionally absent.
- **`useClickOutside`:** does not exist in the repo; Modal handles ESC + overlay-click inline (Task 3) — no dependency introduced.
- **Type consistency:** `ProjectListItem` (Task 1) flows into the list page via `inferRouterOutputs` (Task 8); `ProjectCardData` / `TaskItemData` are the explicit presentational contracts; `ProjectFieldDef` is defined in Task 7 and consumed in Tasks 9–10; `serializeCustom`/`fieldDisplay` are the two halves of custom-field round-tripping.
- **Owner names:** the list/detail pass `ownerName: null` for now (the list endpoint returns `ownerId`, not a name). Showing real names needs a members lookup join — deferred to keep this slice scoped; avatars/names are a fast follow.
