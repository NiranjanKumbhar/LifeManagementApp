# Quick Capture → Project (and New Project on the Go) — Design Spec

> **Date:** 2026-06-13
> **Scope:** Extend the home-screen Quick Capture sheet so a capture can be filed
> directly into an existing project (as a task) or into a brand-new project
> created on the spot — replacing the Inbox|Shopping segmented toggle with a single
> scalable destination picker.
> **Status:** Approved for planning.

## 1. Goal & Context

Quick Capture currently routes to two fixed destinations — **Inbox** (default) and
**Shopping list** (shipped in the prior slice via a `SegmentedControl` toggle +
`useStickyDestination`). Filing a captured item into a project is still a two-step
detour: capture → go to `/inbox` → `assignToProject`. When the user already knows
where something belongs, that's friction.

This slice lets a capture go **straight to a project** as a task, and lets the user
**create a new project on the go** without leaving the sheet. A 2–3 segment toggle
can't represent a growing list of projects, so the toggle is replaced by a single
**`To: ▾` destination picker**.

**Backend is already complete** — `project.list` (active filter), `project.create`
(returns the created project with id), and `task.create({ projectId, title })` all
exist. **No backend, shared-types, or DB changes** — pure frontend.

## 2. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Project routing control | **Unified `To: ▾` destination picker** — Inbox + Shopping list pinned at top, then active projects (searchable when long), then `+ New project…` |
| New-project flow | **Quick create: name + type** (the 6 project types); the already-typed capture becomes the project's **first task**; template/fields/due deferred to the project page |
| Stickiness | **Remember the full destination** (Inbox / Shopping / a specific project) across sessions; visible `To: <name>` label is the safety cue; **fall back to Inbox** if a remembered project is no longer in the active list |
| After submit | Carried over: **Inbox → close**; **Shopping / Project → stay open** for burst-add, clear input, inline confirmation |

### Out of scope (deferred)
- Inline owner / due-date / priority on capture (the schemas allow it; not in v1).
- Full project create (template, per-type fields, description, visibility) from the
  sheet — that remains the `/projects` `ProjectForm`; the quick-create is name+type only.
- Natural-language parsing of the captured text.
- Inbox-triage route to the shopping list (separate future item).
- Native mobile code (`apps/mobile` is scaffolding) — web only; parity noted in §7.
- Changes to the `/inbox` page or any backend.

## 3. Destination model

Destination is a small discriminated value held in `QuickCapture`:

```ts
type CaptureDestination =
  | { kind: 'inbox' }
  | { kind: 'shopping' }
  | { kind: 'project'; projectId: string };
```

`+ New project…` is a menu **action**, not a stored destination. The current
destination's display label is resolved in `QuickCapture`: `Inbox`, `Shopping list`,
or the project's title (looked up from the fetched active project list).

## 4. Components

### 4.1 `DestinationPicker` (new, web-local — `apps/web/src/components/app-shell/`)
- A `To: <label> ▾` trigger button that opens a dropdown menu:
  `Inbox` · `Shopping list` · divider · active projects · divider · `+ New project…`.
- Props: `value: CaptureDestination`, `projects: { id: string; title: string }[]`,
  `onSelect(dest: CaptureDestination)`, `onNewProject()`.
- A search input filters the project rows when the list is long (filter is
  client-side over the passed `projects`).
- Closes on outside `mousedown` and Escape (same local pattern as `StatusPillMenu`);
  keyboard-navigable; large touch-target rows. Presentational — no data fetching.
- Co-located `*.module.css` (`--ls-*` tokens) and `*.test.tsx`.

### 4.2 `QuickCapture` (modified — `apps/web/src/components/app-shell/QuickCapture.tsx`)
Orchestrates everything:
- Replaces the `SegmentedControl` with `DestinationPicker`.
- Fetches `trpc.project.list({ workspaceId, status: 'active' })` with
  `enabled: open && Boolean(workspaceId)`; passes `{ id, title }[]` to the picker and
  uses it for label resolution + sticky fallback (§6).
- Holds a local `mode: 'capture' | 'new-project'` flag and the captured `text`.
- Routes submit per destination (§5); renders the quick-create panel in
  `new-project` mode (§5.2).

### 4.3 Quick-create panel (inside `QuickCapture`)
When `mode === 'new-project'`, the input row is replaced by a compact panel:
**Name** (`Input` text, required) + **Type** (`Input as="select"` over the 6
project types) + a one-line `First task: <captured text>` preview (omitted if the
capture was empty) + **Create** / **Cancel**. Cancel returns to capture mode with the
destination unchanged.

> The `SegmentedControl` component stays in `@lifesync/ui` (still used by `/household`).

## 5. Routing behavior

### 5.1 Normal capture submit (branches on `destination.kind`)
- **inbox** → `inbox.capture({ workspaceId, content })`; on success invalidate
  `inbox.list`, clear text, **close**. (Unchanged.)
- **shopping** → `household.add({ workspaceId, name, status: 'on_list' })`; on success
  invalidate `household.list`, clear text, **stay open**, inline
  "✓ Added to shopping list", keep focus.
- **project** → `task.create({ projectId, title })`; on success invalidate
  `project.get({ id: projectId })` **and** `project.list` (task counts on cards),
  clear text, **stay open**, inline "✓ Added to <project title>", keep focus.

### 5.2 New-project quick-create (Create button)
1. `project.create({ workspaceId, type, title: name })` → returns the new project
   (with `id`).
2. If the captured text is non-empty → `task.create({ projectId: newId, title: text })`.
3. Invalidate `project.list`; set the sticky destination to
   `{ kind: 'project', projectId: newId }`; clear text; return to `capture` mode with
   inline "✓ Created <name>" — subsequent captures flow into the new project.

## 6. State, stickiness & data flow

- `useStickyDestination` is **generalized** to serialize
  `'inbox' | 'shopping' | 'project:<id>'` in localStorage (key unchanged:
  `lifesync.capture.destination`). It returns the parsed `CaptureDestination`;
  default `{ kind: 'inbox' }`; unparseable/invalid → `{ kind: 'inbox' }`. SSR-safe
  (reads in a `useEffect`, window-guarded writes) as before.
- **Project resolution + fallback live in `QuickCapture`** (the hook has no project
  list): on open, if the sticky destination is `{ kind: 'project', projectId }` and
  `projectId` is not in the active `project.list`, treat it as `inbox` and re-persist
  `inbox`. The `To: <name>` label always shows the live target.
- tRPC + React Query throughout; each mutation invalidates only what it affects (§5).

## 7. Error handling & mobile

**Errors** (sheet always stays open, typed text preserved):
- Any single mutation failure → inline "Couldn't save — try again.", scoped to the
  active path (consistent with the prior slice's per-destination error scoping).
- New-project edge: if `project.create` succeeds but the first-task `task.create`
  fails, the project exists — show "Project created, but the task didn't save — try
  again" and route to the new project so re-submitting the text retries **only** the
  task (no orphaned/duplicated project).

**Mobile (parity notes; web-only this slice):** the `To: ▾` menu renders as a
thumb-reachable list with large rows and a search field for long project lists;
selecting a destination keeps the keyboard up for burst-add; the quick-create panel
is two compact fields. The eventual native capture must mirror this.

## 8. Testing

- **`DestinationPicker.test.tsx`:** lists Inbox/Shopping/projects; search filters the
  project rows; selecting a project calls `onSelect` with
  `{ kind: 'project', projectId }`; `+ New project` calls `onNewProject`.
- **`QuickCapture.test.tsx`** (extend; mocks add `project.list`, `task.create`,
  `project.create`):
  1. Default Inbox path unchanged (capture + close).
  2. Selecting a project routes via `task.create({ projectId, title })`, stays open,
     clears.
  3. New-project flow calls `project.create` then `task.create` with the captured
     text, and the new project becomes the sticky destination.
  4. A sticky `project:<id>` absent from the active list falls back to Inbox.
- **`useStickyDestination.test.ts`** (extend): round-trips a `project:<id>` value;
  invalid value → inbox.
- No API or E2E tests (no backend change; repo has no Playwright).

## 9. File-level change summary

**New (web):**
- `apps/web/src/components/app-shell/DestinationPicker.tsx` (+ `.module.css`, `.test.tsx`).

**Changed (web):**
- `apps/web/src/components/app-shell/QuickCapture.tsx` — swap toggle → picker; add
  `project.list` query, the quick-create panel + `mode`, project/new-project routing,
  label resolution + sticky fallback.
- `apps/web/src/components/app-shell/QuickCapture.module.css` — picker row +
  quick-create panel styles.
- `apps/web/src/components/app-shell/QuickCapture.test.tsx` — extend per §8.
- `apps/web/src/lib/hooks/useStickyDestination.ts` — generalize to support
  `project:<id>` (+ extend its test).

**Changed:** none in API / shared-types / DB.
