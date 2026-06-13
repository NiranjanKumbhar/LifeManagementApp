# Quick Capture → Shopping List Destination — Design Spec

> **Date:** 2026-06-13
> **Scope:** Let the home-screen Quick Capture sheet route a capture to the
> Household **shopping list**, not just the Inbox — closing the gap where a
> captured grocery ("buy milk") could only ever become a task in a project.
> **Status:** Approved for planning.

## 1. Goal & Context

Today the Quick Capture sheet (`apps/web/src/components/app-shell/QuickCapture.tsx`,
opened from the sidebar / mobile bottom-nav FAB) writes free text to
`inbox_items` only. The Inbox can then triage an item via `inbox.assignToProject`,
which creates a **task** under a project. There is **no** path from capture to the
Household shopping list (`household_items`). So a grocery captured from the home
screen can never reach the shopping list.

This slice adds a **destination toggle** to the Quick Capture sheet: *Inbox*
(default) or *Shopping list*. Picking Shopping list sends the capture straight to
`household.add` instead of `inbox.capture`.

**Why not a "Groceries" project link (rejected during discussion):** the blueprint
deliberately keeps two mental models — Projects (structured, deadline-aware) vs the
Household stock module (fast, flat, Bring!-style). Making "Groceries" a project
re-merges them into the flat to-do model the blueprint avoids and duplicates the
household module. The right bridge is at the **capture** layer, reusing the
existing `household.add` endpoint.

**No backend, shared-types, or DB changes** — pure frontend. Reuses
`household.add` (creates the item) and the new `SegmentedControl` from Slice B.

## 2. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Destination control | **Segmented toggle** (Inbox \| Shopping list) at the top of the sheet, default Inbox; reuses `@lifesync/ui` `SegmentedControl` |
| After submit | **Destination-dependent:** Inbox → save + **close** (unchanged). Shopping list → save + **stay open**, clear input, inline confirmation, keep focus |
| Default on reopen | **Sticky** — remembers the last destination (persisted to `localStorage`) |
| Mis-route mitigation | Because sticky + shopping items are workspace-**shared** (no privacy), the sheet shows a clear visual cue when the destination is Shopping list |
| Shopping payload | **Minimal** — name only; `status: 'on_list'`; category falls back to the server default (`'other'`). No category/quantity pickers in the sheet |

### Out of scope (deferred)
- Inbox-triage route to the shopping list (`inbox.assignToHousehold`) — a possible
  later slice (Option B from discussion).
- Natural-language / prefix parsing of captures.
- Category, quantity, unit, or auto-replenish entry in the capture sheet (refine on
  `/household`).
- Native mobile app code — `apps/mobile` is still scaffolding; this slice is web
  only (incl. mobile-web). Parity notes are recorded in §6 for the eventual native
  QuickCapture.
- Changes to the Inbox capture behavior, the Inbox page, or `household` routers.

## 3. Behavior

The change is entirely within `QuickCapture.tsx` plus one small hook.

- **Destination toggle:** a `SegmentedControl` with options
  `[{ value: 'inbox', label: 'Inbox' }, { value: 'shopping', label: 'Shopping list' }]`
  at the top of the sheet. Its value is the sticky destination (§5).
- **Submit routing** (`submit()` branches on destination):
  - **Inbox** → `inbox.capture({ workspaceId, content })`; on success invalidate
    `inbox.list`, clear input, **close** the sheet. (Exactly today's behavior.)
  - **Shopping list** → `household.add({ workspaceId, name, status: 'on_list' })`;
    on success invalidate `household.list`, clear input, **keep the sheet open**,
    keep focus in the field, and show an inline "✓ Added to shopping list"
    confirmation that auto-clears on the next keystroke. Esc / tap-away closes.
- **Burst add:** because the shopping path keeps the sheet open and focused, the
  user can type `milk` ⏎ `eggs` ⏎ `bread` ⏎ … without reopening. This is the core
  grocery flow.
- **Visual cue (mis-route safety net):** when destination is Shopping list, the
  input placeholder becomes `"Add to shopping list…"` (Inbox keeps
  `"Capture anything — a task, a reminder, an idea…"`), and the active segment is
  clearly highlighted. This makes it unmistakable that the capture is going to the
  **shared** list, not the private Inbox.
- **Submit button label** follows the destination: `Add` for Inbox (unchanged),
  `Add to list` for Shopping list.

## 4. Data flow & error handling

- `QuickCapture` already has `trpc`, `useWorkspaceId`, and `trpc.useUtils`. Add a
  second mutation `trpc.household.add.useMutation` next to the existing
  `trpc.inbox.capture.useMutation`. Each mutation's `onSuccess` invalidates only
  its own query (`inbox.list` or `household.list`).
- **Errors:** mirror the existing pattern — on mutation error the sheet **stays
  open**, preserves the typed text, and shows the inline error line
  ("Couldn't save — try again."). Now applies to both paths; no data loss
  mid-burst.
- **No workspace:** submit is a no-op (as today).
- `busy` disables submit while either mutation is pending.

## 5. State — sticky destination

- A small reusable hook `useStickyDestination()` in
  `apps/web/src/lib/hooks/useStickyDestination.ts`:
  - Returns `[destination, setDestination]` where destination is
    `'inbox' | 'shopping'`.
  - Backed by `localStorage` under key `lifesync.capture.destination`.
  - **SSR-safe:** initial state is `'inbox'`; the persisted value is read lazily in
    a `useEffect` guarded by `typeof window !== 'undefined'`, then applied. Writes
    happen in `setDestination` (also window-guarded).
  - Default (no stored value / unavailable storage) is `'inbox'`.
- This is the only new shared unit; all other logic stays local to `QuickCapture`.

## 6. Mobile perspective (parity notes)

The native app (`apps/mobile`) is scaffolding only, so no native code ships here.
These notes define the behavior the eventual native QuickCapture must mirror, and
they shape the web implementation so mobile-web feels right now:

- **Bottom-sheet ergonomics:** the sheet is bottom-anchored within thumb reach; the
  toggle and input sit above the on-screen keyboard.
- **Keep the keyboard up:** the "stay open + keep focus" shopping behavior is the
  biggest mobile win — reopening the sheet and re-summoning the keyboard per item
  is the worst friction. The confirmation is **inline and non-dismissing** (no toast
  that steals focus or drops the keyboard).
- **Touch targets:** the segmented control segments meet the 44×44px minimum.
- **Sticky + cue:** on a small screen the visual cue matters more — the
  Shopping-list state must be obvious at a glance to prevent mis-routing a private
  thought to the shared list.

## 7. Testing

Extend `apps/web/src/components/app-shell/QuickCapture.test.tsx`:
1. Default destination is Inbox; Enter calls `inbox.capture` and closes (existing
   behavior preserved).
2. Switching to Shopping list and submitting calls `household.add` with
   `{ name, status: 'on_list' }` and does **not** close; input clears.
3. Burst: two consecutive shopping submits both fire `household.add` while the sheet
   stays open.
4. Placeholder reflects the Shopping list destination ("Add to shopping list…").

New `apps/web/src/lib/hooks/useStickyDestination.test.ts` (or `.tsx`):
- Defaults to `'inbox'` when storage is empty; `setDestination('shopping')`
  persists and is re-read on the next mount (localStorage mocked/jsdom).

No API or E2E tests (no backend change; repo has no Playwright yet).

## 8. File-level change summary

**New (web):**
- `apps/web/src/lib/hooks/useStickyDestination.ts` (+ co-located test).

**Changed (web):**
- `apps/web/src/components/app-shell/QuickCapture.tsx` — add the
  `SegmentedControl` destination toggle, the `household.add` mutation, the
  destination-dependent submit/close/clear behavior, the inline shopping
  confirmation, and the placeholder/label/visual cue.
- `apps/web/src/components/app-shell/QuickCapture.module.css` — styles for the
  toggle row, confirmation line, and shopping-destination accent.
- `apps/web/src/components/app-shell/QuickCapture.test.tsx` — extend per §7.

**Changed:** none in API / shared-types / DB.
