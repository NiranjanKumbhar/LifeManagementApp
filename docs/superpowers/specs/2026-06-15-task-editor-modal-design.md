# Task Editor Modal — Design

> **Date:** 2026-06-15
> **Status:** Approved (design), pending implementation plan
> **Author:** brainstorming session

## Problem

Users cannot edit a task to set or change its **due date**, and there is no way to
attach a **reminder** to a task from the web UI. Some tasks already display a due date,
but only because that date was written directly by seed/template data — there is no
in-app path to reach the `dueDate` field.

The backend already supports everything needed:

- `task.update` accepts `title`, `description`, `status`, `priority`, `ownerId`,
  `dueDate` (`YYYY-MM-DD`, nullable), `sortOrder`, `parentId`, `dependsOnId`,
  `isRecurring`, `recurrenceRule`.
- `workspace.members({ workspaceId })` returns workspace members (owner picker source).
- `reminder.create({ taskId, remindAt, ... })`, `reminder.list({ includeSent })`,
  `reminder.dismiss({ id })` — reminders can attach to a task via `taskId` and are
  delivered by the existing `deliver-due-reminders` cron (in-app notification + Resend email).

The gap is **purely the web UI**: the project detail page (`projects/[id]`) only lets you
toggle completion or add a task by title, and `TaskItem` renders a read-only due-date label
with no edit affordance.

## Goal

A **full task editor** opened by **clicking a task row → modal**, letting the user edit
title, description, due date, priority, owner, and manage reminders (list / add / remove).

No backend changes. No database migration. No mobile changes.

## Design

### 1. Make task rows editable — `TaskItem` (`packages/ui`)

`TaskItem` gains an **optional** prop:

```ts
onEdit?: (taskId: string) => void;
```

- When `onEdit` is provided, the title becomes a keyboard-accessible `<button>` that calls
  `onEdit(task.id)`. The checkbox keeps its own `onToggleComplete` handler, unaffected.
- When `onEdit` is absent, `TaskItem` behaves exactly as today (existing usages such as the
  dashboard are unchanged).
- Accessibility: the edit trigger is a real `<button>` (focusable, Enter/Space activate),
  meeting WCAG 2.1 AA. The checkbox and the edit button are distinct controls.

### 2. `TaskForm` modal — `apps/web/src/components/tasks/TaskForm.tsx`

A web-specific component (not in `@lifesync/ui`), mirroring the existing
`apps/web/src/components/projects/ProjectForm.tsx` pattern. Built from shared components:
`Modal`, `Input`, `SegmentedControl`, `Button`.

Props (shape; finalized in the plan):

```ts
interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskNode;        // the task being edited (from project.get)
  projectId: string;     // for query invalidation
  workspaceId: string;   // for the owner picker
}
```

Fields:

| Field        | Control                         | Maps to (`task.update`)               |
|--------------|---------------------------------|----------------------------------------|
| Title        | `Input`, required               | `title`                                |
| Description  | textarea                        | `description` (nullable)               |
| Due date     | `Input type="date"`             | `dueDate` (`YYYY-MM-DD`; clear → `null`) |
| Priority     | `SegmentedControl`              | `priority` (`none/low/medium/high/urgent`) |
| Owner        | `<select>` from members + "Unassigned" | `ownerId` (uuid; "Unassigned" → `null`) |
| Reminders    | sub-section (see §3)            | — (separate `reminder.*` calls)        |

Behavior:

- State is seeded from `task` when the modal opens.
- Owner options come from `workspace.members({ workspaceId })`, plus an "Unassigned" choice.
- Save calls `task.update` with the changed fields only (including `dueDate: null` / `ownerId: null`
  when cleared), then invalidates `project.get` for the project and closes the modal.
- Status is **not** editable here (it stays driven by the row checkbox).

Opened from the project detail page, which already holds `workspaceId` and the refresh helpers.

### 3. Reminders sub-section (inside the modal)

Reminders are **per-user** — this section manages the current user's reminders for the task,
not the partner's. A short helper line states this.

- **List:** `reminder.list({ includeSent: false })`, filtered client-side to
  `r.taskId === task.id`, soonest-first, showing each reminder's date/time. (There is no
  list-by-task endpoint; client-side filtering fits the personal-per-user model.)
- **Add:** `Input type="datetime-local"` + "Add reminder" button →
  `reminder.create({ taskId: task.id, remindAt: <ISO string> })`. Delivered by the existing
  `deliver-due-reminders` cron.
- **Remove:** each listed reminder has a delete control → `reminder.dismiss({ id })`.
- After add/remove, invalidate the `reminder.list` query.

### 4. Wire into the project detail page (`projects/[id]/page.tsx`)

- Track the task being edited: `const [editingTask, setEditingTask] = useState<TaskNode | null>(null)`.
- Pass `onEdit={() => setEditingTask(task)}` (and the same for children) to each `TaskItem`.
- Render `<TaskForm isOpen={!!editingTask} task={editingTask} ... onClose={() => setEditingTask(null)} />`.

## Testing

- `TaskItem.test.tsx`: `onEdit` fires on title click; when `onEdit` is absent there is no edit
  button and the checkbox still toggles.
- `TaskForm.test.tsx` (following `ProjectForm.test.tsx`): renders seeded values; save sends only
  changed fields including `dueDate: null` on clear and `ownerId: null` on "Unassigned"; reminder
  add and remove call the correct mutations (tRPC mocked).

## Scope / non-goals (YAGNI)

- No subtask reparenting (`parentId`), no recurrence UI, no `dependsOnId`, no status dropdown.
- No backend, schema, or migration changes.
- No mobile changes.

## Affected files

- `packages/ui/src/components/TaskItem/TaskItem.tsx` (+ test) — add `onEdit`.
- `apps/web/src/components/tasks/TaskForm.tsx` (+ `.module.css`, + test) — new.
- `apps/web/src/app/(app)/projects/[id]/page.tsx` — wire click → modal.
