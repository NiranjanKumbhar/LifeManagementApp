# Life Management App — Claude Code Instructions

## Project Overview

This is **LifeSync**, a shared life management app for couples that combines fast task capture with structured project workflows, deadline intelligence, and household coordination. It is a local-first, real-time collaborative app built as a monorepo.

**Read the full product blueprint:** `life-management-app-blueprint.md`

## Development Status

> **Last updated:** 2026-06-14. Keep this section current when finishing a chunk of work.
> Full suite: `pnpm test` → 176 tests passing (api 66, web 78, ui 32; mobile passWithNoTests).

### Done ✅
- **Monorepo + tooling** — Turborepo, pnpm workspaces, tsconfig base, ESLint 9 flat config, Prettier. `pnpm install` / `pnpm build` / `pnpm test` all green.
- **Database** (`apps/api/src/db/`) — Drizzle schema (12 tables), initial migration `0000_initial_schema.sql`, seeds (Alex + Jordan, projects across all 6 types), `db:reset`, query helpers (dashboard/search/urgency). Runs against Supabase (Session pooler).
- **Shared types** (`packages/shared-types`) — all entities, enums, and API input/output types.
- **Backend API** (`apps/api`) — 14 tRPC routers / 53 procedures (workspace, project, task [incl. `reopen`], reminder [`create` allows standalone reminders], household, person [incl. `delete`], notification, resource, template, search, activity, user, **inbox**, **calendar**). `calendar.list({ workspaceId, from, to })` aggregates dated items (project/task due dates, recurring birthdays/anniversaries, the user's reminders), visibility-filtered. Migration `0002` drops the reminders project/task CHECK so standalone reminders are allowed. Thin routers + Result-returning services, Zod validation, 3-tier visibility filtering, workspace-membership checks, activity logging.
- **Quick capture / Inbox** — `inbox_items` table (migration `0001`), `inbox` router (capture / list / assignToProject / dismiss). Web QuickCapture modal persists; `/inbox` page triages items into projects (creates a task) or dismisses. Per-item visibility (private captures stay private). QuickCapture has a **sticky `To: ▾` destination picker** (`useStickyDestination` → `inbox | shopping | project:<id>`): a capture routes to the **Inbox** (save + close), the **Household shopping list** (`household.add`, status `on_list`), an **existing project** (`task.create` — stays open for burst-add), or a **new project created on the go** (`+ New project…` → name + type via `project.create`, with the captured text filed as its first task). A remembered project that's been archived/deleted falls back to Inbox. Components: `DestinationPicker`, `QuickProjectPanel` (app-shell).
- **Auth + user sync** — Clerk JWT middleware, workspace middleware, **JIT user provisioning** on first request, and a Svix-verified **`POST /webhooks/clerk`** endpoint. Server runs tRPC + webhook via `createHTTPHandler` + Node http.
- **Web** (`apps/web`) — Clerk auth (`middleware.ts`, sign-in/up), tRPC client + React Query providers, **app shell** (sidebar, mobile bottom nav, quick-capture FAB/modal), the **Dashboard** page (all 7 blueprint blocks), the **Inbox** page (`/inbox`, triage), and the **Projects** screens (`/projects` list grouped by type with progress bars; `/projects/[id]` single-column detail with task list + inline complete/add, one subtask level; template-driven create/edit modal with per-type custom fields), the **Household** screen (`/household` — Shopping list / Inventory tabs via `SegmentedControl`, items grouped by category, quick-add bar, per-row Got it/Need more + status-pill menu, tap-to-edit modal; household-local components QuickAddBar/StockItemRow/StatusPillMenu/HouseholdItemForm), the **People** screens (`/people` directory with an Upcoming-dates strip + alphabetical list; `/people/[id]` profile with contact/dates/notes, inline `GiftIdeaList` manager, Edit modal + confirm-Delete; `PersonForm`, `nextKeyDate` util), and the **Calendar** screen (`/calendar` — month grid + selected-day agenda over `calendar.list`; bespoke `CalendarGrid`, `DayAgenda`, `ReminderQuickAdd`; click-through to project/person; add a reminder on a day; `monthGridDays`/`CALENDAR_KIND_META` helpers). `ToastProvider` mounted in providers. Design tokens + 14 UI components in `packages/ui` (Button, Card, Badge, UrgencyIndicator, Avatar, PartnerBadge, EmptyState, LoadingSpinner, **Input, Modal, Toast, TaskItem, ProjectCard, SegmentedControl**). Aesthetic: warm "paper", Fraunces + Inter, teal/coral/amber/sage.
- **Tests** — pglite-based integration tests + faker factories in `apps/api/src/__tests__/`; project service/router/urgency covered; web + ui component tests.

### Env / running
- `apps/api/.env` and `apps/web/.env.local` exist (gitignored). API on :3001, web on :3000.
- Dev works without a public webhook URL thanks to JIT provisioning; new Clerk users auto-join `DEFAULT_WORKSPACE_ID` (the seeded "Our Home").

### Remaining 🔭 (roughly prioritized)
1. **Web screens beyond Dashboard + Inbox + Projects + Household + People + Calendar** — Settings (the last slice). (Projects ✅, Household ✅, People ✅, Calendar ✅ done; shared components Input/Modal/Toast/TaskItem/ProjectCard/SegmentedControl ✅ built. Still missing: settings-specific components. **External calendar/contacts sync (Google/Outlook) to import birthdays is a separate future epic** — see `docs/superpowers/specs/2026-06-13-people-slice-c-design.md` §2.)
2. **Inngest background jobs** (`apps/api/src/jobs/` is empty) — reminder delivery, weekly digest, recurring tasks, escalation, cleanup. **Reminders are written to the DB but never delivered**, and nothing creates `notifications` rows yet.
3. **Supabase Storage** — `resource.upload` only stores metadata; no real upload/download or storage-object deletion.
4. **Tests for the other routers/services** (workspace, task, reminder, household, person, notification, resource, template, search, activity, user) + Playwright E2E (none yet).
5. **Mobile app** (`apps/mobile`) — scaffolding only (3 stub files). Entire RN/Expo app, tRPC client, RxDB, PowerSync, notifications, haptics.
6. **Local-first sync** — RxDB + PowerSync not set up anywhere (core architectural pillar).
7. **Middleware** — `rateLimit`, `logging` not built (only `auth` + `workspace`).
8. **DevOps** — no CI/CD (`.github/` empty), no deploy config (Vercel/EAS/API host), no monitoring.

### Known stubs / shortcuts to revisit
- `workspace.invite` → throws `NOT_IMPLEMENTED` (needs Clerk Organizations; replaces the `DEFAULT_WORKSPACE_ID` auto-join shortcut for real multi-couple use).
- `person.get` returns `projects: []` (no person↔project FK yet).
- **Migration `0002_reminders_standalone.sql` must be applied to live Supabase** (`pnpm db:migrate`) — it drops the `reminders_check` constraint so standalone reminders (e.g. Calendar's "add a reminder on a day") work. Applied automatically in pglite tests; the production DB still needs it.
- **Calendar shows reminders but they are not delivered** — no Inngest jobs yet, so a reminder only appears on the calendar (no notification). The `/calendar` UI deliberately avoids any "you'll be notified" copy.
- **`/settings` is still a 404** (Slice E pending) but the desktop sidebar links to it; the mobile bottom nav omits it.
- **External calendar/contacts sync (Google/Outlook) to import birthdays is a deliberately separate future epic** (needs OAuth + provider APIs + dedup + background jobs) — not part of the Calendar slice. See `docs/superpowers/specs/2026-06-13-people-slice-c-design.md` §2.
- `activity.feed` applies visibility filtering after the DB limit (page can under-fill).
- No tRPC transformer (superjson): `Date` fields cross the wire as ISO strings.
- API integration tests boot a fresh pglite per test (~1s each) — switch to shared instance + tx rollback if the suite gets slow.
- Projects UI shows owner avatars/names as `null` (the `project.list` row has `ownerId` but no resolved name; needs a members lookup join). `project.list` returns `taskCount`/`completedCount` (taskCount excludes cancelled). Task completion is reversible (`task.complete` / `task.reopen`, toggled by the detail checkbox). Tasks order deterministically by `(sortOrder, createdAt, id)` via `apps/api/src/utils/task-order.ts` — they default to `sortOrder 0`, so the tiebreakers keep the list stable across refetches.

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend (Web) | Next.js 15 (App Router) + TypeScript | Web application with SSR/SSG |
| Frontend (Mobile) | React Native + Expo SDK 52 | iOS & Android mobile apps |
| Shared UI | React component library (shared package) | Design system & reusable components |
| Shared Types | TypeScript package | Type definitions shared across all packages |
| Local Data | RxDB + SQLite adapter | Offline-first local storage with reactive queries |
| Sync Engine | PowerSync | Local-first sync between device and cloud |
| Backend API | Node.js + tRPC v11 | End-to-end type-safe API layer |
| ORM | Drizzle ORM | Type-safe database queries and schema management |
| Cloud Database | PostgreSQL 16 (Supabase) | Primary cloud database |
| Background Jobs | Inngest | Reminder scheduling, digests, recurring jobs |
| Authentication | Clerk | User auth, workspace invites, session management |
| Object Storage | Supabase Storage | Documents, attachments, receipts, images |
| Realtime | Supabase Realtime + PowerSync | Live partner updates & collaboration |
| Testing | Vitest + React Testing Library + Playwright | Unit, integration, and E2E tests |
| Linting/Formatting | ESLint 9 + Prettier | Code quality and consistency |
| Monorepo | Turborepo | Build orchestration, caching, task pipeline |

## Directory Structure

```
lifesync/
├── CLAUDE.md                          # ← You are here (root instructions)
├── life-management-app-blueprint.md   # Product blueprint & requirements
├── .claude/
│   ├── settings.json                  # Claude Code permissions & settings
│   └── commands/                      # Custom slash commands for agents
│       ├── frontend.md                # /frontend — Frontend development tasks
│       ├── backend.md                 # /backend — Backend API development
│       ├── database.md                # /database — Schema & migration tasks
│       ├── mobile.md                  # /mobile — React Native development
│       ├── testing.md                 # /testing — Test writing & execution
│       └── review.md                  # /review — Code review tasks
├── docs/
│   ├── agents/                        # Agent-specific instruction files
│   │   ├── frontend-agent.md
│   │   ├── backend-agent.md
│   │   ├── database-agent.md
│   │   ├── mobile-agent.md
│   │   ├── testing-agent.md
│   │   └── devops-agent.md
│   ├── architecture/
│   │   ├── system-overview.md         # High-level architecture
│   │   ├── data-model.md              # Database schema & entity relationships
│   │   ├── api-contracts.md           # tRPC router definitions & API specs
│   │   ├── sync-strategy.md           # Local-first sync & conflict resolution
│   │   └── security-model.md          # Auth, authorization, privacy model
│   └── guides/
│       ├── getting-started.md         # Developer setup guide
│       ├── coding-conventions.md      # Style guide & patterns
│       └── deployment.md             # Deployment procedures
├── packages/
│   ├── shared-types/                  # Shared TypeScript type definitions
│   │   ├── CLAUDE.md
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts
│   │       ├── entities/              # Core entity types
│   │       ├── api/                   # API request/response types
│   │       └── enums/                 # Shared enumerations
│   └── ui/                            # Shared design system & components
│       ├── CLAUDE.md
│       ├── package.json
│       └── src/
│           ├── components/            # Reusable UI components
│           ├── tokens/                # Design tokens (colors, spacing, typography)
│           ├── hooks/                 # Shared React hooks
│           └── utils/                 # UI utility functions
├── apps/
│   ├── web/                           # Next.js web application
│   │   ├── CLAUDE.md
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   └── src/
│   │       ├── app/                   # App Router pages & layouts
│   │       ├── components/            # Web-specific components
│   │       ├── lib/                   # Utilities, hooks, providers
│   │       └── styles/                # Global styles & CSS modules
│   ├── mobile/                        # React Native + Expo app
│   │   ├── CLAUDE.md
│   │   ├── package.json
│   │   ├── app.config.ts
│   │   └── src/
│   │       ├── screens/               # Mobile screens
│   │       ├── components/            # Mobile-specific components
│   │       ├── navigation/            # Navigation configuration
│   │       └── lib/                   # Mobile utilities & hooks
│   └── api/                           # Backend API server
│       ├── CLAUDE.md
│       ├── package.json
│       └── src/
│           ├── routers/               # tRPC routers (one per domain)
│           ├── services/              # Business logic services
│           ├── db/                     # Database client, migrations, seeds
│           ├── jobs/                   # Inngest background job definitions
│           ├── middleware/             # Auth, logging, rate limiting
│           └── utils/                 # Server utilities
├── turbo.json                         # Turborepo pipeline configuration
├── package.json                       # Root workspace package.json
├── tsconfig.base.json                 # Base TypeScript configuration
├── eslint.config.js                   # Root ESLint configuration (ESLint 9 flat config)
├── .prettierrc                        # Prettier formatting rules
├── .gitignore
└── .claudeignore                      # Files Claude should ignore
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Start all apps in development mode
pnpm dev

# Start specific apps
pnpm dev --filter=web
pnpm dev --filter=api
pnpm dev --filter=mobile

# Run all tests
pnpm test

# Run tests for specific package
pnpm test --filter=web
pnpm test --filter=api

# Lint all packages
pnpm lint

# Format code
pnpm format

# Build all packages
pnpm build

# Database migrations
pnpm db:migrate
pnpm db:seed
pnpm db:reset

# Type checking
pnpm typecheck
```

## Coding Conventions

### General Rules
- **TypeScript everywhere** — No `any` types. Use strict mode. All files must be `.ts` or `.tsx`.
- **Functional components only** — No class components in React.
- **Named exports** — Prefer named exports over default exports (except for Next.js pages).
- **Absolute imports** — Use `@/` path alias within each package. Use `@lifesync/shared-types` and `@lifesync/ui` for cross-package imports.
- **Error handling** — Use Result types or explicit error boundaries. Never silently swallow errors.
- **No magic strings** — Use enums or constants from `@lifesync/shared-types`.

### Naming Conventions
- **Files:** `kebab-case.ts` for utilities, `PascalCase.tsx` for React components
- **Variables/Functions:** `camelCase`
- **Types/Interfaces:** `PascalCase`, prefix interfaces with `I` only for service interfaces
- **Constants:** `UPPER_SNAKE_CASE`
- **Database columns:** `snake_case`
- **API routes:** `camelCase` (tRPC convention)
- **CSS classes:** `kebab-case` (CSS Modules)

### Component Pattern
```tsx
// Always co-locate: Component.tsx, Component.test.tsx, Component.module.css
// Props must be explicitly typed
interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  variant?: 'compact' | 'detailed';
}

export function TaskCard({ task, onComplete, variant = 'compact' }: TaskCardProps) {
  // Component logic
}
```

### Commit Convention
```
feat(scope): add quick-capture modal
fix(api): resolve reminder scheduling race condition
docs(agents): update backend agent instructions
chore(deps): upgrade tRPC to v11.1
```

## Agent Roles

This project is designed for multi-agent development. Each agent has a dedicated instruction file in `docs/agents/`.

| Agent | Scope | Instruction File |
|---|---|---|
| **Frontend Agent** | Web UI, design system, components, pages | `docs/agents/frontend-agent.md` |
| **Backend Agent** | API routers, services, business logic, jobs | `docs/agents/backend-agent.md` |
| **Database Agent** | Schema design, migrations, queries, seeds | `docs/agents/database-agent.md` |
| **Mobile Agent** | React Native screens, navigation, native features | `docs/agents/mobile-agent.md` |
| **Testing Agent** | Unit tests, integration tests, E2E tests | `docs/agents/testing-agent.md` |
| **DevOps Agent** | CI/CD, deployment, infrastructure, monitoring | `docs/agents/devops-agent.md` |

### Agent Workflow
1. **Database Agent** works first — establishes schema and migrations
2. **Backend Agent** builds API layer on top of the database schema
3. **Frontend Agent** and **Mobile Agent** build UIs consuming the API
4. **Testing Agent** writes tests across all layers
5. **DevOps Agent** configures CI/CD and deployment

### Cross-Agent Contracts
- **Shared types** in `packages/shared-types/` are the source of truth for all entity shapes
- **API contracts** defined in `docs/architecture/api-contracts.md`
- **Database schema** defined in `docs/architecture/data-model.md`
- Agents MUST NOT duplicate type definitions — always import from shared packages

## Important Context

- This is a **local-first** app — reads come from local DB, writes sync in background
- The app serves **couples** — shared visibility, partner-aware notifications, and privacy are core concerns
- **Project typing** is a key differentiator — occasions, compliance, household, health, travel, planning
- **Deadline intelligence** means lead-time awareness, escalating urgency, and risk scoring
- Performance must feel **instant** — no loading spinners for core interactions
- Design should feel **calm, warm, and trustworthy** — not like enterprise project management software
