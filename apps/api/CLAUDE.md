# API Server — apps/api

## Overview

tRPC v11 API server running on Node.js. Provides the backend for LifeSync — business logic, database access, background jobs, and sync support.

## Directory Structure

```
src/
├── index.ts                    # Server entry point
├── trpc.ts                     # tRPC initialization, base procedures
├── routers/
│   ├── index.ts                # Root router (combines all sub-routers)
│   ├── workspace.ts
│   ├── project.ts
│   ├── task.ts
│   ├── reminder.ts
│   ├── household.ts
│   ├── person.ts
│   ├── notification.ts
│   ├── resource.ts
│   ├── template.ts
│   ├── search.ts
│   ├── activity.ts
│   └── user.ts
├── services/                   # Business logic layer
│   ├── workspace.service.ts
│   ├── project.service.ts
│   ├── task.service.ts
│   ├── reminder.service.ts
│   ├── household.service.ts
│   ├── notification.service.ts
│   ├── search.service.ts
│   ├── urgency.service.ts
│   └── digest.service.ts
├── db/
│   ├── client.ts               # Drizzle ORM client
│   ├── schema.ts               # Database schema
│   ├── migrations/
│   └── seeds/
├── jobs/                       # Inngest background jobs
│   ├── reminders.ts
│   ├── digest.ts
│   ├── recurring.ts
│   ├── escalation.ts
│   └── cleanup.ts
├── middleware/
│   ├── auth.ts                 # Clerk JWT validation
│   ├── workspace.ts            # Workspace authorization
│   ├── rateLimit.ts
│   └── logging.ts
└── utils/
    ├── errors.ts               # Result type, AppError
    ├── validation.ts           # Shared Zod schemas
    └── dates.ts                # Date/deadline utilities
```

## Key Conventions

- **Thin routers, fat services** — Routers handle I/O; services contain business logic
- **Result pattern** — Services return `Result<T, AppError>`, never throw untyped errors
- **Zod validation** on every mutation input
- **Workspace-scoped** — Every query checks workspace membership
- **Visibility-filtered** — Every list/get query respects the 3-tier visibility model
- **Audit logged** — All mutations create activity events

## Development

```bash
pnpm dev --filter=api           # Starts on http://localhost:3001
```

## Testing

```bash
pnpm test --filter=api          # Unit + integration tests
```

## Database

```bash
pnpm db:migrate                 # Run migrations
pnpm db:seed                    # Seed development data
pnpm db:reset                   # Reset and reseed (destructive)
```
