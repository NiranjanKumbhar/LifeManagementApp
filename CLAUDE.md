# Life Management App — Claude Code Instructions

## Project Overview

This is **LifeSync**, a shared life management app for couples that combines fast task capture with structured project workflows, deadline intelligence, and household coordination. It is a local-first, real-time collaborative app built as a monorepo.

**Read the full product blueprint:** `life-management-app-blueprint.md`

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
├── .eslintrc.js                       # Root ESLint configuration
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
