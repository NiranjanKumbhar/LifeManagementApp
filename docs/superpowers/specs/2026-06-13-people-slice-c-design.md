# Slice C — People (Web) — Design Spec

> **Date:** 2026-06-13
> **Scope:** The `/people` directory + `/people/[id]` profile web screens, an inline
> gift-ideas manager, and a small `person.delete` backend addition. Third
> sub-project of the "Web screens beyond Dashboard + Inbox" roadmap item
> (A=Projects ✅, B=Household ✅).
> **Status:** Approved for planning.

## 1. Goal & Context

The sidebar links to `/people`, but the route does not exist (404). This slice
delivers the People experience: a couple's "relationship memory" — family,
friends, service contacts — with key dates (birthday/anniversary) that feed the
app's deadline awareness, plus a gift-ideas tracker.

The backend is largely ready: the `person` router exposes `list`, `get`
(returns the person + a `projects: []` stub — no person↔project FK yet), `create`,
and `update`. `Person` has: `name, relationship, birthday, anniversary, email,
phone, notes, giftIdeas[] , customFields`. `GiftIdea` is `{ idea, budget?,
purchased?, url? }`.

**One small backend addition** this slice: `person.delete` (there is no
delete/archive endpoint today, and a directory needs removal). Everything else is
frontend.

## 2. Decisions (locked during brainstorming)

| Question | Decision |
|---|---|
| Layout | **List + detail route** — `/people` directory + `/people/[id]` profile (like Projects) |
| List order | **Alphabetical + an "Upcoming" strip** (anyone with a birthday/anniversary within ~30 days, soonest first) over the alphabetical list; each row shows relationship + next-date countdown |
| Removal | **Add `person.delete`** (small backend) + a Delete action with confirm on the detail page |
| Gift ideas | **Full** — idea + optional budget + purchased toggle + optional url; managed **inline** on the detail page (not in the edit modal) |

### Out of scope (deferred)
- Person ↔ project linking (no FK; `person.get` keeps returning `projects: []`; no
  projects section on the profile).
- `customFields` editing (no People field registry; left untouched).
- Reminders generated from birthdays/anniversaries (deadline jobs are a separate
  roadmap item; the dashboard already surfaces upcoming dates).
- **External calendar / contacts sync (Google Calendar, Outlook/Microsoft) to
  import birthdays & people.** This is a separate, larger subsystem — OAuth with
  Google + Microsoft, Calendar/People (Contacts) API reads, event→person mapping,
  de-duplication on re-sync, token storage, and background sync jobs (tied to the
  Inngest jobs roadmap item). It gets its **own** spec, likely alongside Slice D
  (Calendar). Slice C is the manual foundation it will populate. **Forward-compat
  note:** an imported person is just a `Person` with a `birthday`; clean,
  idempotent import will later want a `source` / `externalId` marker on `people`
  to avoid duplicates on re-sync — a deliberate **schema change deferred to that
  spec**, not added here (this slice does not pre-build import hooks — YAGNI).
- Photos/avatars beyond an initial-based `Avatar`.
- Optimistic updates (fast invalidation + Toast, consistent with prior slices).
- Other screens (Calendar, Settings).

## 3. Backend change

`person.delete` — `protectedProcedure.input(personIdSchema).mutation` calling a new
`PersonService.delete(db, userId, id)`:

- Find the person; if absent → `notFound`.
- `assertWorkspaceMembership(db, userId, person.workspaceId)`; if not a member →
  `notFound` (don't leak existence).
- Delete the row inside a transaction; `logActivity(... action: 'deleted')`.
- Return `ok(...)` (e.g. `{ id }`).

`personIdSchema` already exists. No shared-types or DB-schema changes (the `people`
table already exists). **Test:** one API integration test — delete removes the
row; a non-member receives `not-found` and the row survives.

## 4. Web pages

Routes under `apps/web/src/app/(app)/people/`, client components, mirroring the
Projects route files.

### 4.1 `/people` — directory
- Route: `page.tsx` (+ `loading.tsx`, `people.module.css`, `page.test.tsx`).
- Fetches `trpc.person.list({ workspaceId })` via `useWorkspaceId`.
- For each person computes the **next key date** (next annual occurrence of
  birthday or anniversary, whichever is sooner) client-side (§5).
- **Upcoming strip:** people with a next key date within **30 days**, soonest
  first, shown as compact chips (name + 🎂/💗 + countdown). Hidden when none.
- **Directory list:** all people **alphabetical by name**; each row shows an
  `Avatar` (initial), name, relationship, and the next-date countdown pill (or
  nothing when no dates). Clicking a row navigates to `/people/[id]`.
- **New person** button opens `PersonForm` (create mode).
- States: `LoadingSpinner` while loading; `EmptyState` on error; `EmptyState`
  ("No people yet") when the list is empty (New person button still present).

### 4.2 `/people/[id]` — profile
- Route: `[id]/page.tsx` (+ module css, `page.test.tsx`).
- Fetches `trpc.person.get({ id })`.
- **Header:** back link, `Avatar` + name, relationship, next-date pill, and
  actions: **Edit** (opens `PersonForm` edit mode) and **Delete**.
- **Delete:** a confirm step (inline confirm or a small confirm modal) → on
  confirm calls `person.delete({ id })`; on success Toast + navigate to `/people`.
- **Body sections:** contact (email as `mailto:`, phone), key dates
  (birthday/anniversary, formatted + next-occurrence), notes, and the
  **`GiftIdeaList`** inline manager (§4.3).
- States: loading; not-found/error → friendly "Person not found"; empty gift list
  → gentle "No gift ideas yet" inside the section.

### 4.3 Gift-ideas manager (`GiftIdeaList`)
- Renders each `GiftIdea`: a **purchased** checkbox (toggle), idea text (struck
  through when purchased), optional **budget** (formatted `£`), optional **url**
  (opens in a new tab, `rel="noopener noreferrer"`), and a **remove** (✕).
- An **+ add** row captures: idea (required), budget (number, optional), url
  (optional).
- Driven by props `giftIdeas: GiftIdea[]` and `onChange(next: GiftIdea[])`. Every
  action (toggle/add/remove) computes the new array and calls `onChange`; the
  detail page persists via `person.update({ id, giftIdeas })`. Presentational +
  local "add" form state only — no data fetching.

## 5. Components, util & reuse

**New web-local (`apps/web/src/components/people/`):**
- `PersonForm.tsx` (+ module css) — create/edit **modal** for core fields: name
  (required), relationship, birthday (`type="date"`), anniversary (`type="date"`),
  email, phone, notes (`as="textarea"`). Submits `person.create` / `person.update`;
  Toast + close + invalidate `person.list` (and `person.get` on edit). Mirrors
  `ProjectForm`. Gift ideas are **not** in this modal.
- `GiftIdeaList.tsx` (+ module css) — see §4.3.

**New web util (`apps/web/src/lib/people/dates.ts`):**
- `nextOccurrence(dateStr: string): Date` — the next annual occurrence of a
  `YYYY-MM-DD` date (this year if still upcoming, else next year; today counts as
  upcoming).
- `nextKeyDate(person): { date: Date; kind: 'birthday' | 'anniversary'; daysUntil: number } | null`
  — the sooner of the person's birthday/anniversary occurrences, or `null` when
  neither is set. Pure; unit-tested. Used by the list (strip + row) and the detail
  header.

**Reused from `@lifesync/ui`:** `Modal`, `Input`, `Button`, `Avatar`, `Badge` /
`UrgencyIndicator` (date pill), `EmptyState`, `LoadingSpinner`, `useToast`,
`formatShortDate` / `formatRelativeDate` / `daysUntil`.

## 6. Data flow & state

- tRPC + React Query throughout (matching Projects/Household).
- `/people` → `person.list`; `/people/[id]` → `person.get`.
- Mutations (invalidate in `onSuccess` + Toast):
  - `person.create` → invalidate `person.list`.
  - `person.update` (core fields **and** gift-idea changes) → invalidate
    `person.get({ id })` + `person.list`.
  - `person.delete` → invalidate `person.list`, navigate to `/people`.
- Gift-idea toggle/add/remove each send the whole `giftIdeas` array via
  `person.update` (the array is the unit of update). No optimistic updates.
- Dates cross the wire as ISO strings; `nextKeyDate` parses `YYYY-MM-DD` and
  formats via the `@lifesync/ui` date helpers.

## 7. Error handling

- Every query renders explicit loading / empty / error states (no bare spinners).
- Mutations surface failures via Toast; `PersonForm` shows inline validation via
  `Input`'s `error` prop (e.g. invalid email mirrors the server Zod message).
- The profile treats API not-found (incl. a person the user can't read) as a
  friendly "Person not found", not a crash.
- Delete requires explicit confirmation before firing.

## 8. Testing

- **API (integration):** `person.delete` removes the row; a non-member receives
  not-found and the row survives.
- **Web (Vitest + RTL):**
  1. `/people` renders the Upcoming strip + alphabetical list with next-date
     countdowns.
  2. `PersonForm` create submits `person.create` with the entered fields.
  3. Profile renders gift ideas; toggling **purchased** calls `person.update` with
     the updated `giftIdeas` array.
  4. **Delete** → confirm calls `person.delete({ id })`.
- **Unit:** `nextKeyDate` / `nextOccurrence` — picks the sooner date, rolls to next
  year when this year's has passed, returns `null` when no dates.
- No Playwright E2E (consistent with the repo).

## 9. File-level change summary

**New (web):**
- `apps/web/src/app/(app)/people/page.tsx` (+ `loading.tsx`, `people.module.css`,
  `page.test.tsx`).
- `apps/web/src/app/(app)/people/[id]/page.tsx` (+ module css, `page.test.tsx`).
- `apps/web/src/components/people/PersonForm.tsx` (+ module css).
- `apps/web/src/components/people/GiftIdeaList.tsx` (+ module css).
- `apps/web/src/lib/people/dates.ts` (+ `dates.test.ts`).

**Changed (API):**
- `apps/api/src/routers/person.ts` — add `delete` procedure.
- `apps/api/src/services/person.service.ts` — add `delete`.
- Plus the integration test.

**Changed:** none in shared-types / DB. The `/people` sidebar link already exists.
