# System Architecture Overview

## High-Level Architecture

LifeSync follows a **local-first, monorepo** architecture with clear separation between frontend clients, shared packages, and the backend API.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Client Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Next.js Web  │  │ React Native │  │   Shared Design System   │  │
│  │  (App Router) │  │  (Expo SDK)  │  │   (@lifesync/ui)         │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────────┘  │
│         │                  │                                         │
│  ┌──────┴──────────────────┴───────┐                                │
│  │        Local Database            │                                │
│  │   RxDB + SQLite (on device)     │                                │
│  └──────────────┬──────────────────┘                                │
└─────────────────┼───────────────────────────────────────────────────┘
                  │  PowerSync (bidirectional sync)
┌─────────────────┼───────────────────────────────────────────────────┐
│                 │       Backend Layer                                 │
│  ┌──────────────┴──────────────────┐  ┌──────────────────────────┐  │
│  │        tRPC API Server           │  │    Inngest Job Runner    │  │
│  │   (Node.js + TypeScript)        │  │  (reminders, digests,    │  │
│  │                                  │  │   recurring tasks)       │  │
│  └──────────────┬──────────────────┘  └───────────┬──────────────┘  │
│                 │                                   │                 │
│  ┌──────────────┴───────────────────────────────────┴──────────────┐ │
│  │                    PostgreSQL (Supabase)                         │ │
│  │          + Supabase Auth (Clerk) + Supabase Storage             │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Read Path (Local-First)
```
User Action → RxDB Query (local) → Instant UI Update
                                     ↓ (background)
                              PowerSync polls server
                                     ↓
                              PostgreSQL → PowerSync → RxDB → UI updates reactively
```

### Write Path (Local-First with Sync)
```
User Action → RxDB Write (local) → Instant UI Update
                  ↓ (background)
           PowerSync Upload Queue
                  ↓
           tRPC API → Validation → PostgreSQL
                  ↓
           Broadcast to partner's device via PowerSync
```

### Notification Path
```
Inngest Cron → Check reminders due → Create notification record
                                       ↓
                               Push via Expo Push / Web Push
                                       ↓
                               Sync notification to device via PowerSync
```

## Monorepo Structure

```
lifesync/                          # Turborepo workspace root
├── apps/
│   ├── web/                       # Next.js 15 web app
│   ├── mobile/                    # React Native + Expo
│   └── api/                       # tRPC API server
├── packages/
│   ├── shared-types/              # @lifesync/shared-types
│   └── ui/                        # @lifesync/ui (design system)
└── turbo.json                     # Build pipeline
```

### Dependency Graph
```
shared-types ← ui ← web
shared-types ← ui ← mobile
shared-types ← api
```

`shared-types` has zero dependencies and is imported by all other packages. `ui` depends on `shared-types`. Apps depend on both.

## Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Local-first | RxDB + PowerSync | Instant UX, offline support, real-time partner sync |
| Monorepo | Turborepo | Shared types, unified CI, consistent conventions |
| API | tRPC | End-to-end type safety, auto-generated client |
| Database | PostgreSQL | Relational integrity, JSONB flexibility, mature ecosystem |
| Auth | Clerk | Easy workspace invites, session management, social login |
| Background Jobs | Inngest | Reliable scheduling, retries, observability |
| Styling | CSS Modules | Scoped styles, no runtime cost, SSR-compatible |
| State (client) | RxDB reactive + Zustand (UI) | Local data reactivity + lightweight UI state |

## Security Architecture

See `docs/architecture/security-model.md` for full details.

- **Authentication**: Clerk JWT tokens validated on every API request
- **Authorization**: Workspace membership + visibility-based filtering
- **Encryption**: TLS in transit, AES-256 at rest (Supabase managed)
- **Privacy**: Three-tier visibility model (shared / mine-visible / private)
