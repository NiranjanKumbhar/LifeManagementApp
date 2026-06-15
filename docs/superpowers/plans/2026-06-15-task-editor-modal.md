# Task Editor Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users click a task row to open a modal that edits the task's title, description, due date, priority, and owner, and add/remove reminders for that task.

**Architecture:** Reuse existing APIs only (`task.update`, `workspace.members`, `reminder.list/create/dismiss`) — no backend or migration changes. Add an optional `onEdit` affordance to the shared `TaskItem`, build a web-specific `TaskForm` modal mirroring `ProjectForm`, and wire it into the project detail page. Widen the shared `Input` to accept `datetime-local` for the reminder field.

**Tech Stack:** Next.js 15 (App Router, client components), tRPC v11 + React Query, `@lifesync/ui` (Modal/Input/Button/SegmentedControl), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-06-15-task-editor-modal-design.md`

---

## File Structure

- `packages/ui/src/components/Input/Input.tsx` (modify) — add `'datetime-local'` to the text input `type` union.
- `packages/ui/src/components/Input/Input.test.tsx` (modify) — assert the datetime-local type renders.
- `packages/ui/src/components/TaskItem/TaskItem.tsx` (modify) — optional `onEdit` prop turns the title into an edit button.
- `packages/ui/src/components/TaskItem/TaskItem.module.css` (modify) — button reset for the title trigger.
- `packages/ui/src/components/TaskItem/TaskItem.test.tsx` (modify) — `onEdit` fires; absent prop keeps old behavior.
- `apps/web/src/components/tasks/TaskForm.tsx` (create) — the editor modal.
- `apps/web/src/components/tasks/TaskForm.module.css` (create) — modal-local styles.
- `apps/web/src/components/tasks/TaskForm.test.tsx` (create) — seeded values, save payload, reminder add/remove.
- `apps/web/src/app/(app)/projects/[id]/page.tsx` (modify) — track edited task, pass `onEdit`, render `TaskForm`.

---

## Task 1: Widen `Input` to accept `datetime-local`

**Files:**
- Modify: `packages/ui/src/components/Input/Input.tsx:20-23`
- Test: `packages/ui/src/components/Input/Input.test.tsx`

- [ ] **Step 1: Add a failing test**

Append this test inside the `describe('Input', ...)` block in `packages/ui/src/components/Input/Input.test.tsx` (before the closing `});`):

```tsx
  it('renders a datetime-local input', () => {
    render(<Input label="Remind at" value="" onChange={() => {}} type="datetime-local" />);
    expect(screen.getByLabelText('Remind at')).toHaveAttribute('type', 'datetime-local');
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter=@lifesync/ui test -- Input`
Expected: TypeScript/test failure — `'datetime-local'` is not assignable to the `type` prop union.

- [ ] **Step 3: Widen the type union**

In `packages/ui/src/components/Input/Input.tsx`, change the `TextProps` definition:

```tsx
type TextProps = BaseProps & {
  as?: 'input';
  type?: 'text' | 'number' | 'date' | 'time' | 'datetime-local';
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter=@lifesync/ui test -- Input`
Expected: PASS (all Input tests green).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Input/Input.tsx packages/ui/src/components/Input/Input.test.tsx
git commit -m "feat(ui): allow datetime-local type on Input"
```

---

## Task 2: Add an `onEdit` affordance to `TaskItem`

**Files:**
- Modify: `packages/ui/src/components/TaskItem/TaskItem.tsx`
- Modify: `packages/ui/src/components/TaskItem/TaskItem.module.css`
- Test: `packages/ui/src/components/TaskItem/TaskItem.test.tsx`

- [ ] **Step 1: Add failing tests**

Append these two tests inside the `describe('TaskItem', ...)` block in `packages/ui/src/components/TaskItem/TaskItem.test.tsx` (before the closing `});`):

```tsx
  it('fires onEdit with the id when the title is clicked', async () => {
    const onEdit = vi.fn();
    render(<TaskItem task={baseTask} depth={0} onToggleComplete={() => {}} onEdit={onEdit} />);
    await userEvent.click(screen.getByRole('button', { name: /send invitations/i }));
    expect(onEdit).toHaveBeenCalledWith('t1');
  });

  it('renders the title as plain text when onEdit is not provided', () => {
    render(<TaskItem task={baseTask} depth={0} onToggleComplete={() => {}} />);
    expect(screen.queryByRole('button', { name: /send invitations/i })).not.toBeInTheDocument();
    expect(screen.getByText('Send invitations')).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter=@lifesync/ui test -- TaskItem`
Expected: FAIL — `onEdit` is not a prop; no button with that name is rendered.

- [ ] **Step 3: Implement the optional edit button**

Replace the body of `packages/ui/src/components/TaskItem/TaskItem.tsx` with:

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
  onEdit?: (taskId: string) => void;
}

export function TaskItem({ task, depth, onToggleComplete, onEdit }: TaskItemProps) {
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
      {onEdit ? (
        <button
          type="button"
          className={cn(styles.titleButton, done && styles.done)}
          onClick={() => onEdit(task.id)}
        >
          {task.title}
        </button>
      ) : (
        <span className={cn(styles.title, done && styles.done)}>{task.title}</span>
      )}
      {task.dueDate ? <span className={styles.due}>{formatRelativeDate(task.dueDate)}</span> : null}
      {task.ownerName ? <span className={styles.owner}>{task.ownerName}</span> : null}
    </div>
  );
}
```

- [ ] **Step 4: Add the button style**

Append to `packages/ui/src/components/TaskItem/TaskItem.module.css`:

```css
.titleButton {
  font-size: var(--ls-text-base);
  color: var(--ls-text-primary);
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  text-align: left;
  cursor: pointer;
  font: inherit;
}
.titleButton:hover {
  color: var(--ls-primary-600);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter=@lifesync/ui test -- TaskItem`
Expected: PASS (all TaskItem tests green, including the existing checkbox tests).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/TaskItem/
git commit -m "feat(ui): optional onEdit affordance on TaskItem"
```

---

## Task 3: Build the `TaskForm` modal

**Files:**
- Create: `apps/web/src/components/tasks/TaskForm.tsx`
- Create: `apps/web/src/components/tasks/TaskForm.module.css`
- Test: `apps/web/src/components/tasks/TaskForm.test.tsx`

Notes for the implementer:
- `project.get` returns full task rows, so a task node has `id`, `title`, `description`, `dueDate` (`YYYY-MM-DD` | null), `priority`, `ownerId` (uuid | null).
- `workspace.members` returns rows shaped `{ ...member, user: { id, displayName, email, avatarUrl } }`.
- `reminder.list` returns the current user's reminders; each row has `id`, `taskId`, `remindAt` (ISO string over the wire). Filter to this task client-side.
- There is no superjson transformer, so dates cross the wire as strings.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/tasks/TaskForm.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const updateMutate = vi.fn();
const createReminderMutate = vi.fn();
const dismissReminderMutate = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      project: { get: { invalidate: vi.fn() } },
      reminder: { list: { invalidate: vi.fn() } },
    }),
    workspace: {
      members: {
        useQuery: () => ({
          data: [{ user: { id: 'u1', displayName: 'Alex' } }, { user: { id: 'u2', displayName: 'Jordan' } }],
        }),
      },
    },
    reminder: {
      list: { useQuery: () => ({ data: [{ id: 'r1', taskId: 't1', remindAt: '2026-07-01T09:00:00.000Z' }] }) },
      create: { useMutation: () => ({ mutate: createReminderMutate, isPending: false }) },
      dismiss: { useMutation: () => ({ mutate: dismissReminderMutate, isPending: false }) },
    },
    task: {
      update: { useMutation: (o: { onSuccess?: () => void }) => ({ mutate: (...a: unknown[]) => { updateMutate(...a); o.onSuccess?.(); }, isPending: false }) },
    },
  },
}));

import { TaskForm } from './TaskForm';

const task = {
  id: 't1',
  title: 'Book appointment',
  description: 'Call the office',
  status: 'pending',
  dueDate: '2026-07-10',
  priority: 'medium',
  ownerId: 'u1',
  children: [],
};

function renderForm() {
  return render(
    <ToastProvider>
      <TaskForm
        isOpen
        onClose={() => {}}
        task={task as never}
        projectId="p1"
        workspaceId="ws-1"
      />
    </ToastProvider>,
  );
}

describe('TaskForm', () => {
  it('seeds fields from the task', () => {
    renderForm();
    expect(screen.getByLabelText(/Title/)).toHaveValue('Book appointment');
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-07-10');
  });

  it('clearing the due date saves dueDate: null', async () => {
    renderForm();
    await userEvent.clear(screen.getByLabelText('Due date'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateMutate).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', dueDate: null }));
  });

  it('lists existing reminders and dismisses one', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: /remove reminder/i }));
    expect(dismissReminderMutate).toHaveBeenCalledWith({ id: 'r1' });
  });

  it('adds a reminder from the datetime field', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('Remind me at'), '2026-08-01T09:00');
    await userEvent.click(screen.getByRole('button', { name: 'Add reminder' }));
    expect(createReminderMutate).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 't1', remindAt: expect.any(String) }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter=web test -- TaskForm`
Expected: FAIL — `Cannot find module './TaskForm'`.

- [ ] **Step 3: Create the component**

Create `apps/web/src/components/tasks/TaskForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import type { Priority } from '@lifesync/shared-types';
import { Button, Input, Modal, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import styles from './TaskForm.module.css';

type ProjectDetail = inferRouterOutputs<AppRouter>['project']['get'];
type TaskNode = ProjectDetail['tasks'][number];

export interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskNode;
  projectId: string;
  workspaceId: string;
}

const PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export function TaskForm({ isOpen, onClose, task, projectId, workspaceId }: TaskFormProps) {
  const toast = useToast();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [priority, setPriority] = useState<Priority>(task.priority ?? 'none');
  const [ownerId, setOwnerId] = useState(task.ownerId ?? '');
  const [remindAt, setRemindAt] = useState('');

  const members = trpc.workspace.members.useQuery({ workspaceId }, { enabled: isOpen });
  const reminders = trpc.reminder.list.useQuery({ includeSent: false }, { enabled: isOpen });
  const taskReminders = (reminders.data ?? []).filter((r) => r.taskId === task.id);

  const refreshReminders = () => void utils.reminder.list.invalidate();

  const update = trpc.task.update.useMutation({
    onSuccess: () => {
      void utils.project.get.invalidate({ id: projectId });
      toast.success('Task updated');
      onClose();
    },
  });
  const createReminder = trpc.reminder.create.useMutation({
    onSuccess: () => {
      setRemindAt('');
      refreshReminders();
    },
  });
  const dismissReminder = trpc.reminder.dismiss.useMutation({ onSuccess: refreshReminders });

  const ownerOptions = [
    { value: '', label: 'Unassigned' },
    ...(members.data ?? []).map((m) => ({ value: m.user.id, label: m.user.displayName })),
  ];

  const save = () => {
    if (!title.trim() || update.isPending) return;
    update.mutate({
      id: task.id,
      title: title.trim(),
      description: description || null,
      dueDate: dueDate || null,
      priority,
      ownerId: ownerId || null,
    });
  };

  const addReminder = () => {
    if (!remindAt || createReminder.isPending) return;
    createReminder.mutate({ taskId: task.id, remindAt: new Date(remindAt).toISOString() });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit task"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!title.trim() || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Input label="Title" value={title} onChange={setTitle} required />
        <Input as="textarea" label="Description" value={description} onChange={setDescription} />
        <Input type="date" label="Due date" value={dueDate} onChange={setDueDate} />
        <Input
          as="select"
          label="Priority"
          value={priority}
          onChange={(v) => setPriority(v as Priority)}
          options={PRIORITIES}
        />
        <Input as="select" label="Owner" value={ownerId} onChange={setOwnerId} options={ownerOptions} />

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>Reminders</legend>
          <p className={styles.hint}>These are your personal reminders for this task.</p>
          {taskReminders.length > 0 ? (
            <ul className={styles.reminderList}>
              {taskReminders.map((r) => (
                <li key={r.id} className={styles.reminderRow}>
                  <span>{new Date(r.remindAt).toLocaleString()}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remove reminder"
                    onClick={() => dismissReminder.mutate({ id: r.id })}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.hint}>No reminders yet.</p>
          )}
          <div className={styles.addReminder}>
            <Input type="datetime-local" label="Remind me at" value={remindAt} onChange={setRemindAt} />
            <Button variant="secondary" size="sm" onClick={addReminder} disabled={!remindAt || createReminder.isPending}>
              Add reminder
            </Button>
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: Create the styles**

Create `apps/web/src/components/tasks/TaskForm.module.css`:

```css
.form {
  display: flex;
  flex-direction: column;
  gap: var(--ls-space-4);
}
.fieldset {
  border: 1px solid var(--ls-surface-border);
  border-radius: var(--ls-radius-md);
  padding: var(--ls-space-4);
  display: flex;
  flex-direction: column;
  gap: var(--ls-space-3);
}
.legend {
  font-size: var(--ls-text-sm);
  font-weight: 600;
  color: var(--ls-text-secondary);
  padding: 0 var(--ls-space-2);
}
.hint {
  font-size: var(--ls-text-xs);
  color: var(--ls-text-tertiary);
  margin: 0;
}
.reminderList {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ls-space-2);
}
.reminderRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ls-space-3);
  font-size: var(--ls-text-sm);
  color: var(--ls-text-primary);
}
.addReminder {
  display: flex;
  align-items: flex-end;
  gap: var(--ls-space-3);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter=web test -- TaskForm`
Expected: PASS (all four TaskForm tests green).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/tasks/
git commit -m "feat(web): TaskForm editor modal (due date, priority, owner, reminders)"
```

---

## Task 4: Wire `TaskForm` into the project detail page

**Files:**
- Modify: `apps/web/src/app/(app)/projects/[id]/page.tsx`

- [ ] **Step 1: Import `TaskForm`**

In `apps/web/src/app/(app)/projects/[id]/page.tsx`, add the import after the `ProjectForm` import (around line 14):

```tsx
import { TaskForm } from '@/components/tasks/TaskForm';
```

- [ ] **Step 2: Add edited-task state**

After `const [editing, setEditing] = useState(false);` (around line 49), add:

```tsx
  const [editingTask, setEditingTask] = useState<TaskNode | null>(null);
```

- [ ] **Step 3: Pass `onEdit` to both TaskItem usages**

In the tasks `.map(...)` block (around lines 171-198), add `onEdit` to the parent and child `TaskItem`s:

For the parent `TaskItem`, add the prop:

```tsx
              onToggleComplete={() => toggleTask(task)}
              onEdit={() => setEditingTask(task)}
```

For the child `TaskItem`, add the prop:

```tsx
                onToggleComplete={() => toggleTask(child)}
                onEdit={() => setEditingTask(child)}
```

- [ ] **Step 4: Render the modal**

Immediately after the existing `<ProjectForm ... />` block (around line 226), before the closing `</PageShell>`, add:

```tsx
      {editingTask && workspaceId ? (
        <TaskForm
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          task={editingTask}
          projectId={project.id}
          workspaceId={workspaceId}
        />
      ) : null}
```

- [ ] **Step 5: Verify build + existing page test pass**

Run: `pnpm --filter=web test -- "projects/\[id\]"`
Expected: PASS (existing `page.test.tsx` still green).

Run: `pnpm --filter=web typecheck`
Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(app)/projects/[id]/page.tsx"
git commit -m "feat(web): open TaskForm from project detail task rows"
```

---

## Task 5: Full verification

- [ ] **Step 1: Build the UI package (consumed by web)**

Run: `pnpm --filter=@lifesync/ui build`
Expected: success.

- [ ] **Step 2: Run the full test suite**

Run: `pnpm test`
Expected: all packages green; ui gains the new TaskItem/Input tests, web gains TaskForm tests.

- [ ] **Step 3: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: clean.

- [ ] **Step 4: Manual smoke (optional, if running locally)**

Start web (`pnpm dev --filter=web` + api), open a project, click a task title → modal opens seeded with the task; change due date/priority/owner → Save → row reflects the new due date; add a reminder → it appears in the list; remove it → it disappears.

---

## Self-Review Notes

- **Spec coverage:** TaskItem clickability (Task 2) ✓; TaskForm fields title/description/due/priority/owner (Task 3) ✓; reminders list/add/remove (Task 3) ✓; page wiring (Task 4) ✓; tests (Tasks 1-4) ✓; non-goals (no status/recurrence/parentId, no backend) respected ✓.
- **Type consistency:** `onEdit?: (taskId: string) => void` used identically in Task 2 component and Task 4 callers; `TaskFormProps` fields (`isOpen/onClose/task/projectId/workspaceId`) match the Task 4 render site; `Priority` import drives both the `priority` state and the `PRIORITIES` option list.
- **Datetime handling:** `datetime-local` value → `new Date(value).toISOString()` satisfies `createReminderSchema.remindAt` (`z.string().datetime()`); dates cross the wire as strings (no superjson), so `r.remindAt` is parsed with `new Date(...)`.
