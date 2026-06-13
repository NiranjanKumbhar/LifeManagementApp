# Slice B — Household / Grocery (Web) — Design Spec

> **Date:** 2026-06-13
> **Scope:** The `/household` web screen — a shared grocery / stock module with a
> Shopping-list and an Inventory view over `household_items`. Second sub-project of
> the "Web screens beyond Dashboard + Inbox" roadmap item (Slice A = Projects, done).
> **Status:** Approved for planning.

## 1. Goal & Context

The sidebar links to `/household`, but the route does not exist yet (404). This
slice delivers the household experience end-to-end on web: a calm, fast,
Bring!-style grocery/stock module with low-stock tracking, shared across the
couple's workspace.

The backend is **already complete** — `household` router exposes `list`
(filter by `status` / `category`), `add`, `update`, `purchase` (→ `stocked`,
records `lastPurchased`), and `restock` (→ `out`). `HouseholdItem` has:
`name, category, status, quantity, unit, autoReplenish, lastPurchased,
sortOrder`. Status enum: `stocked | low | out | on_list`.

**This is a pure frontend slice — no backend, shared-types, or DB changes.**

It reuses design-system components from Slice A and earlier (Modal, Input, Toast,
Badge, Button, EmptyState, LoadingSpinner) and adds one new reusable component
(`SegmentedControl`) plus a small set of household-specific web components.

## 2. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Top-level page model | **Two tabs** — *Shopping list* (out/low/on_list) + *Inventory* (all, grouped by category) |
| Item action model | **Primary action + status menu** — one obvious action per row, plus a status pill that doubles as a menu to set any of the 4 states |
| Add flow | **Quick-add bar + edit modal** — inline `+ Add item…` (Enter to add instantly); tapping a row opens the full edit modal |
| Category source | **Curated category list** surfaced as a `select`, stored as the plain string (free-text legacy values still render) |

### Out of scope (deferred)
- Realtime live-sync between partners (PowerSync/Supabase Realtime — separate
  roadmap pillar; this slice relies on query invalidation).
- Optimistic updates (consistent with Slice A — fast invalidation + Toast only).
- Drag-to-reorder within a category (`sortOrder` is honored read-only).
- Auto-replenish automation (the `autoReplenish` flag is editable here, but the
  background job that acts on it is part of the Inngest jobs roadmap item).
- Per-item assignee / owner avatars (no owner concept on household items beyond
  `addedBy`; not surfaced in v1).
- Other screens (People, Calendar, Settings).

## 3. Page structure

Route: `apps/web/src/app/(app)/household/page.tsx` (client component), with
`loading.tsx`, `household.module.css`, and `page.test.tsx` — mirroring the
Projects route.

A single `trpc.household.list({ workspaceId })` query fetches all items once.
A `SegmentedControl` switches between two client-side views over that data:

### 3.1 Shopping list tab
- Items where `status ∈ {out, low, on_list}`, grouped by category in the
  curated order.
- Quick-add bar adds new items as **`on_list`** by default.
- Per-row primary action: **✓ Got it** → `household.purchase(id)` (→ `stocked`,
  sets `lastPurchased`, item leaves the shopping list).
- Per-row status pill menu → `household.update` to set any of the 4 states.
- Empty (no out/low/on_list items, but inventory non-empty): friendly
  "All stocked up 🎉" `EmptyState`.

### 3.2 Inventory tab
- All items, grouped by category in the curated order.
- Quick-add bar adds new items as **`stocked`** by default.
- Per-row primary action: **+ Need more** → `household.restock(id)` (→ `out`,
  item appears on the shopping list).
- Status pill shows current status; menu sets any of the 4 states via `update`.
- Rows show `quantity · unit` when present, and "Last bought {date}" when
  `lastPurchased` is set.

Tapping any row (either tab) opens the **edit Modal**.

## 4. Components

### 4.1 New shared component — `@lifesync/ui`
**`SegmentedControl`** — the tab switcher.
- Props: `options: { value: string; label: string }[]`, `value`, `onChange`,
  optional `ariaLabel`.
- `role="tablist"` semantics, arrow-key navigation, visible focus ring,
  WCAG AA, respects `prefers-reduced-motion`. Tokens only, no hardcoded colors.
- Co-located `*.module.css`, `*.test.tsx`, `index.ts`, exported from the barrel.
- Promoted to the package because People/Settings slices will reuse it.

### 4.2 Web-local components — `apps/web/src/components/household/`
- **`StockItemRow`** — one item row: name, `quantity · unit`, `StatusPillMenu`,
  and the tab-appropriate primary action button. Purely presentational; props
  `item`, `tab`, `onPrimary(id)`, `onSetStatus(id, status)`, `onEdit(item)`.
- **`StatusPillMenu`** — the `[status ▾]` control. Renders a `Badge` styled per
  status; opens a small menu (reuses `useClickOutside` from `@lifesync/ui`) to
  pick any of `stocked | low | out | on_list`. Keyboard-accessible.
- **`QuickAddBar`** — inline `+ Add item…` text input; Enter submits
  `household.add` with the tab-default status; clears on success.
- **`HouseholdItemForm`** — the edit-modal body (mirrors `ProjectForm`): name,
  category (curated `select`), status (`select`), quantity (`number`), unit
  (`text`), auto-replenish (boolean). Rendered inside `Modal`. Submits
  `household.update`.

### 4.3 Metadata
- **`apps/web/src/lib/household/category-meta.ts`** — `HOUSEHOLD_CATEGORY_META`
  (curated categories with label + order) and `HOUSEHOLD_CATEGORY_ORDER`,
  mirroring `lib/projects/project-meta.ts`. Curated set:
  `Produce, Dairy, Meat & seafood, Bakery, Frozen, Pantry, Beverages,
  Household supplies, Personal care, Other`. Stored as the plain string;
  free-text/legacy categories render under their own heading appended after the
  curated ones. Quick-added items default to `Other`.
- **Status visual mapping** (Badge tones): `stocked` → sage/positive,
  `low` → amber, `out` → coral/danger, `on_list` → teal/neutral. Defined
  alongside the category meta (`HOUSEHOLD_STATUS_META`: label + tone).

## 5. Data flow & state

- tRPC + React Query throughout, matching dashboard/projects.
- One `household.list` query; tabs and category grouping are client-side derived.
- Every mutation (`add`, `update`, `purchase`, `restock`) invalidates
  `household.list` in `onSuccess`, fires a success Toast, and surfaces errors via
  Toast.
- No optimistic updates in v1 — fast invalidation keeps it responsive.
- Active workspace via `useWorkspaceId`. `lastPurchased` crosses the wire as an
  ISO string (known repo quirk — no superjson); format with the `@lifesync/ui`
  `format-date` util.

## 6. States & error handling

- **Loading:** `LoadingSpinner` (and a `loading.tsx` suspense boundary).
- **Query error:** explicit error panel with a retry affordance.
- **Empty (no items at all):** `EmptyState` — "Nothing tracked yet — add your
  first item", with the quick-add bar still present.
- **Shopping list empty (inventory non-empty):** "All stocked up 🎉" state.
- **Per-category sections with zero items are omitted.**
- Mutation failures surface through Toast; the edit form shows inline validation
  errors via `Input`'s `error` prop, mirroring server Zod messages where
  practical.

## 7. Testing

- **UI package (Vitest + RTL):** `SegmentedControl` — selection callback +
  keyboard navigation + `role="tablist"` wiring.
- **Web (Vitest + RTL):**
  1. Shopping list shows only `out/low/on_list` items, grouped by category.
  2. "Got it" triggers the `household.purchase` mutation.
  3. Quick-add submits `household.add` with the tab-default status.
  4. Status pill menu sets a new status via `household.update`.
- **API:** none — no backend change this slice.
- No Playwright E2E (consistent with the current repo).

## 8. File-level change summary

**New (UI):** `packages/ui/src/components/SegmentedControl/*` (+ barrel export).

**New (web):**
- `apps/web/src/app/(app)/household/page.tsx` (+ `loading.tsx`,
  `household.module.css`, `page.test.tsx`).
- `apps/web/src/components/household/{StockItemRow,StatusPillMenu,QuickAddBar,
  HouseholdItemForm}.tsx` (+ module css where needed).
- `apps/web/src/lib/household/category-meta.ts`
  (`HOUSEHOLD_CATEGORY_META/ORDER`, `HOUSEHOLD_STATUS_META`).

**Changed:** none in API / shared-types / DB. The `/household` link in the
sidebar already exists.
