# Slice A — Projects (Web) — Design Spec

> **Date:** 2026-06-12
> **Scope:** Projects list + Project detail web screens, plus the shared UI
> components they introduce. First sub-project of the larger "Web screens beyond
> Dashboard + Inbox" item in the project roadmap.
> **Status:** Approved for planning.

## 1. Goal & Context

The web app currently ships only `/dashboard` and `/inbox`. The sidebar links to
`/projects`, `/household`, `/calendar`, `/people`, and `/settings`, but none of
those routes exist — visiting `/projects` returns a 404.

This slice delivers the **Projects** experience end-to-end on web:

- `/projects` — a list of the workspace's projects, **grouped by project type**,
  each project shown as a card with a task-progress bar.
- `/projects/[id]` — a **single-column** detail page with the project's
  type-specific fields and an interactive task list.
- A create/edit flow (modal) that can **start from a template** and edits both
  **core fields and per-type custom fields**.

It also establishes five reusable design-system components (Input, Modal, Toast,
TaskItem, ProjectCard) that later slices (Household, People, Calendar, Settings)
will reuse.

The backend is already largely ready: `project` (list/get/create/update/complete/
archive), `task` (list/create/update/complete/reorder/move), and `template`
(list/get) routers all exist. `project.create` already instantiates template
tasks and merges template + type default fields atomically.

## 2. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Projects list layout | **A — grouped by project type**, with a progress bar on each card |
| Project detail layout | **B — single column / stacked** |
| Task depth in v1 | **One level of subtasks** (top-level tasks + one nesting level) |
| Custom fields in create/edit | **Core + per-type fields** (all 6 type field sets) |
| Create flow | **Start from a template** (template picker), blank allowed |

### Out of scope (deferred to later slices)
- Resources / attachments on the detail page.
- Reminders UI (reminders are still created server-side only).
- Task drag-to-reorder (the `task.reorder` / `task.move` APIs stay unused here).
- Nesting deeper than one subtask level.
- Person ↔ project linking (blocked on the missing FK; `person.get` stub).
- Other screens (Household, Calendar, People, Settings).

## 3. Backend change

**Only one change**, additive and backward-compatible.

`ProjectService.list` currently returns bare project rows. Project cards need a
progress bar, so the list must include task counts.

- Extend `ProjectService.list` to aggregate, per project, the total task count and
  the completed task count (left join / grouped subquery on `tasks`, where
  completed means `status = 'completed'` per the `TaskStatus` enum).
- New output type in `@lifesync/shared-types`:
  ```ts
  export interface ProjectListItem extends Project {
    taskCount: number;
    completedCount: number;
  }
  ```
  `project.list` now returns `ProjectListItem[]`.
- No input changes, no new endpoint, no change to `project.get`.
- Visibility filtering, ordering (`dueDate asc nulls last`), and the existing
  `type` / `status` / `ownerId` filters are preserved unchanged.

**Test:** one API integration test asserting counts are correct for a project with
a mix of done/not-done tasks, and `0/0` for a project with no tasks.

## 4. New shared components (`packages/ui`)

All live under `packages/ui/src/components/<Name>/` with co-located
`*.module.css`, `*.test.tsx`, and `index.ts`, exported from the package barrel.
They use design tokens (no hardcoded colors), meet WCAG AA, and respect
`prefers-reduced-motion`. Web-facing for this slice but written
platform-agnostically where practical.

### 4.1 Input
- Labeled field wrapper supporting `text | number | date | textarea | select`.
- Props: `label`, `value`, `onChange`, `error?`, `helperText?`, `required?`,
  plus type-specific extras (e.g. `options` for select).
- Associates `<label htmlFor>` with the control; renders error text with
  `aria-invalid` / `aria-describedby`.

### 4.2 Modal
- Focus-trapped dialog rendered in a portal over a `surface.overlay` backdrop.
- Closes on ESC and on outside click (reuse the package's `useClickOutside` hook).
- Restores focus to the trigger on close. Enter/exit animation respects reduced
  motion. Props: `isOpen`, `onClose`, `title`, `children`, optional `footer`.

### 4.3 Toast
- `ToastProvider` (context) + `useToast()` hook exposing
  `toast.success/error/info(message)`.
- Auto-dismiss (default ~4s) with manual dismiss; stacked; `role="status"` /
  `aria-live="polite"`. Provider mounted once in the web providers tree.

### 4.4 TaskItem
- A single task row: checkbox (complete toggle), title with strike-through when
  done, optional due-date pill and owner avatar.
- Supports **one** level of indentation for subtasks and a "+ add subtask"
  affordance under a parent.
- Props: `task`, `onToggleComplete(taskId)`, `onAddSubtask?(parentId)`,
  `depth: 0 | 1`. Purely presentational — no data fetching.

### 4.5 ProjectCard
- Type icon + title, urgency due-pill (via existing `UrgencyIndicator` /
  `urgency-color` util), owner avatar, and a **progress bar**
  (`completedCount` / `taskCount`; hidden or shown as "No tasks" when
  `taskCount === 0`).
- Props: `project: ProjectListItem`, `href`. Renders as a link to the detail page.

## 5. Web pages

### 5.1 `/projects` — list (layout A)
- Route: `apps/web/src/app/(app)/projects/page.tsx` (client component).
- Fetches `trpc.project.list` for the active workspace (`useWorkspaceId`).
- Header: page title, a **status filter** (Active / All — maps to the `status`
  input; "Active" excludes completed/archived), and a **New project** button that
  opens the create modal.
- Body: projects grouped into sections by `type`, in a fixed type order
  (occasion, compliance, household, health, travel, planning, general). Each
  section renders a heading with a count and a responsive `ProjectCard` grid.
  Empty type sections are omitted.
- States: `LoadingSpinner` while loading; `EmptyState` when the workspace has no
  projects or none match the filter; error state when the query fails.
- `loading.tsx` route suspense boundary mirroring the dashboard pattern.

### 5.2 `/projects/[id]` — detail (layout B)
- Route: `apps/web/src/app/(app)/projects/[id]/page.tsx` (client component).
- Fetches `trpc.project.get` (returns the project + nested task tree).
- Single-column layout:
  1. **Header** — back link, type icon + title, urgency pill, owner avatar, and
     actions: **Edit** (opens the modal in edit mode), **Complete**
     (`project.complete`), **Archive** (`project.archive`).
  2. **Progress bar** — derived from the task tree (done / total).
  3. **Type-specific details strip** — renders the project's `customFields`
     through the per-type field registry (read view).
  4. **Task list** — `TaskItem`s rendered from the task tree (one subtask level):
     inline complete (`task.complete`), "+ Add task" (`task.create` top-level),
     "+ add subtask" (`task.create` with `parentId`).
- States: loading, not-found / error (e.g. private project the user can't read →
  the API returns not-found), each with appropriate copy.

## 6. Create / Edit project (Modal)

A single `ProjectForm` component reused for both create and edit, rendered inside
`Modal`.

- **Create mode** opens with an optional **template picker**: lists
  `trpc.template.list` for the workspace; selecting a template pre-fills type and
  fields; a "Blank project" choice is always available. The chosen `templateId`
  is sent to `project.create` (the service instantiates default tasks + fields).
- **Core fields** (both modes): `type` (create only — type is immutable on edit),
  `title`, `description`, `dueDate`, `priority`, `ownerId`, `visibility`.
- **Per-type custom fields**: a `PROJECT_FIELD_SCHEMA` registry maps each
  `ProjectType` to its field set (the `OccasionFields`, `ComplianceFields`,
  `HouseholdProjectFields`, `HealthFields`, `TravelFields`, `PlanningFields`
  interfaces in `shared-types`). Each field declares a control kind (text /
  number / date / string-list / boolean) so the form renders the right `Input`s.
  Values are collected into `customFields` and sent as-is (the API accepts
  `customFields: Record<string, unknown>`).
- Submit calls `project.create` or `project.update`; on success: fire a success
  Toast, close the modal, and invalidate `project.list` (create/edit) and
  `project.get` (edit). On error: show the error via Toast / inline message.
- Owner selector options come from the workspace members
  (`trpc.workspace.members({ workspaceId })`).

## 7. Data flow & state

- tRPC + React Query throughout, matching the dashboard/inbox pattern.
- Mutations invalidate the relevant queries in `onSuccess`:
  - create/edit/complete/archive project → invalidate `project.list`
    (+ `project.get` for the affected id).
  - task complete/create → invalidate `project.get` for the project.
- `Date` fields cross the wire as ISO strings (known repo quirk — no superjson);
  format with the existing `@lifesync/ui` `format-date` util.
- No optimistic updates in v1 — rely on fast invalidation + Toast feedback. (The
  blueprint's "instant" goal is fully realized once local-first sync lands; that's
  a separate roadmap item.)

## 8. Error handling

- Every query renders explicit loading / empty / error states (no bare spinners
  on success paths).
- Mutations surface failures through Toast; forms show inline validation errors
  via `Input`'s `error` prop, mirroring server Zod messages where practical.
- Detail page treats API not-found (including visibility-hidden projects) as a
  friendly "project not found" state, not a crash.

## 9. Testing

- **UI package (Vitest + RTL):** a co-located test per new component — Input
  (label/error wiring), Modal (open/close, ESC, focus return), Toast
  (show/auto-dismiss via provider), TaskItem (toggle callback, subtask
  indentation), ProjectCard (progress rendering, no-tasks case).
- **Web (Vitest + RTL):** projects list groups by type and shows counts; project
  detail toggles a task and triggers the complete mutation; create modal renders
  per-type fields when the type changes.
- **API (integration):** the new `project.list` task counts.
- No Playwright E2E in this slice (consistent with the current repo, which has
  none yet).

## 10. File-level change summary

**New (UI):** `packages/ui/src/components/{Input,Modal,Toast,TaskItem,ProjectCard}/*`
(+ barrel exports).

**New (web):** `apps/web/src/app/(app)/projects/page.tsx` (+ `loading.tsx`,
`projects.module.css`); `apps/web/src/app/(app)/projects/[id]/page.tsx`
(+ module css); `apps/web/src/components/projects/ProjectForm.tsx` and the
per-type field registry; wire `ToastProvider` into `apps/web/src/lib/providers`.

**Changed (API):** `apps/api/src/services/project.service.ts` (`list` counts);
`packages/shared-types` (`ProjectListItem`); `project.list` return type flows
through automatically.

**Changed (shared-types):** add `ProjectListItem`; export the per-type field
registry types if shared between form + detail (otherwise keep the registry in web).
