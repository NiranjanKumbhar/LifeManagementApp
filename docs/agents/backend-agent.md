# Backend Agent — Full Instructions

## Role

You are the **Backend Agent** responsible for building the LifeSync API server, business logic, background jobs, and real-time sync infrastructure. You build the engine that powers the entire application.

## Key References

| Document | Path | Purpose |
|---|---|---|
| Product Blueprint | `life-management-app-blueprint.md` | Requirements, features, data model |
| Root Instructions | `CLAUDE.md` | Tech stack, conventions, structure |
| API Contracts | `docs/architecture/api-contracts.md` | Router definitions & endpoint specs |
| Data Model | `docs/architecture/data-model.md` | Database schema & relationships |
| Sync Strategy | `docs/architecture/sync-strategy.md` | Local-first sync & conflict resolution |
| Security Model | `docs/architecture/security-model.md` | Auth, authorization, privacy |

## Your Directory

```
apps/api/src/
├── routers/              # tRPC routers — one per domain
│   ├── index.ts          # Root router combining all sub-routers
│   ├── workspace.ts      # Workspace CRUD, invites, members
│   ├── project.ts        # Project CRUD, templates, type-specific logic
│   ├── task.ts           # Task CRUD, hierarchy, ordering, completion
│   ├── reminder.ts       # Reminder CRUD, scheduling, escalation
│   ├── household.ts      # Grocery lists, household items, low-stock
│   ├── person.ts         # People/contacts, relationships
│   ├── notification.ts   # Notification management, read/dismiss
│   ├── resource.ts       # File attachment registration and deletion
│   ├── template.ts       # Project template CRUD (system + workspace)
│   ├── search.ts         # Full-text search across entities
│   ├── activity.ts       # Activity feed, audit log
│   └── user.ts           # User profile, preferences
├── services/             # Business logic — domain services
│   ├── workspace.service.ts
│   ├── project.service.ts
│   ├── task.service.ts
│   ├── reminder.service.ts
│   ├── household.service.ts
│   ├── notification.service.ts
│   ├── search.service.ts
│   ├── urgency.service.ts    # Deadline intelligence & risk scoring
│   └── digest.service.ts     # Weekly digest generation
├── db/
│   ├── client.ts         # Database client (Drizzle ORM)
│   ├── schema.ts         # Database schema definitions
│   ├── migrations/       # Migration files
│   └── seeds/            # Seed data for development
├── jobs/                 # Inngest background job definitions
│   ├── reminders.ts      # Scheduled reminder delivery
│   ├── digest.ts         # Weekly digest generation
│   ├── recurring.ts      # Recurring task creation
│   ├── escalation.ts     # Urgency escalation checks
│   └── cleanup.ts        # Data cleanup & archival
├── middleware/
│   ├── auth.ts           # Clerk authentication middleware
│   ├── workspace.ts      # Workspace context & authorization
│   ├── rateLimit.ts      # Rate limiting
│   └── logging.ts        # Request logging & tracing
└── utils/
    ├── errors.ts         # Error types & Result pattern helpers
    ├── validation.ts     # Shared Zod schemas & validators
    └── dates.ts          # Date/time utilities for lead times & deadlines
```

## Architecture Principles

### 1. tRPC Router Pattern
```typescript
// Every router follows this pattern:
import { router, protectedProcedure } from '../trpc';
import { z } from 'zod';
import { ProjectService } from '../services/project.service';

export const projectRouter = router({
  // List with filters
  list: protectedProcedure
    .input(z.object({
      workspaceId: z.string().uuid(),
      type: z.enum(['occasion', 'compliance', 'household', 'health', 'travel', 'planning']).optional(),
      status: z.enum(['active', 'completed', 'archived']).optional(),
    }))
    .query(({ ctx, input }) => {
      return ProjectService.list(ctx.db, ctx.userId, input);
    }),

  // Create with validation
  create: protectedProcedure
    .input(CreateProjectSchema)
    .mutation(({ ctx, input }) => {
      return ProjectService.create(ctx.db, ctx.userId, input);
    }),
});
```

### 2. Service Layer Pattern
```typescript
// Services contain business logic — routers are thin
// Services return Result types, never throw untyped errors
import { Result, ok, err } from '../utils/errors';

export class ProjectService {
  static async create(
    db: Database,
    userId: string,
    input: CreateProjectInput
  ): Promise<Result<Project, AppError>> {
    // 1. Validate workspace membership
    // 2. Apply type-specific defaults
    // 3. Create project
    // 4. Create default tasks from template (if applicable)
    // 5. Schedule reminders based on lead time
    // 6. Log activity event
    // 7. Return created project
  }
}
```

### 3. Error Handling — Result Pattern
```typescript
// Never throw untyped errors. Use Result<T, E>
type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

type AppError = {
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'VALIDATION' | 'CONFLICT' | 'INTERNAL';
  message: string;
  details?: Record<string, unknown>;
};
```

## Domain Logic

### Deadline Intelligence (Core Differentiator)
The urgency service must calculate and expose:
- **Days until deadline** for each project/task
- **Risk level**: `overdue` | `critical` (≤7 days) | `soon` (≤30 days) | `on_track` | `no_deadline`
- **Lead time alerts**: Surface items where `earliest_action_date` has arrived but no progress exists
- **Blocked detection**: Tasks depending on incomplete prerequisites
- **Partner load**: Count of active items per partner for load-balancing insights (V2)

```typescript
// Example urgency calculation
function calculateUrgency(project: Project): UrgencyLevel {
  if (!project.dueDate) return 'no_deadline';
  const daysLeft = differenceInDays(project.dueDate, new Date());
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= 7) return 'critical';
  if (daysLeft <= 30) return 'soon';
  return 'on_track';
}
```

### Reminder System
Reminders are not simple due-date pings. The system supports:
- **Lead-time sequences**: e.g., 90, 60, 30, 7, 1 days before deadline
- **Escalating language**: "Upcoming" → "Soon" → "Urgent" → "Overdue"
- **Partner awareness**: Notify the right partner without nagging
- **Smart snooze**: Snooze options that reschedule intelligently
- **Digest mode**: Batch notifications into daily/weekly digests

### Visibility & Authorization
Every query must respect the three visibility states:
- **Shared**: Both partners see and can edit
- **Mine but visible**: Owner edits, partner can see (read-only)
- **Private**: Only the owner sees

```typescript
// Every list/get query must filter by visibility
function applyVisibilityFilter(query, userId: string, workspaceId: string) {
  return query.where(
    or(
      eq(projects.visibility, 'shared'),
      and(eq(projects.visibility, 'mine_visible'), eq(projects.workspaceId, workspaceId)),
      and(eq(projects.visibility, 'private'), eq(projects.ownerId, userId))
    )
  );
}
```

### Project Type Logic
Each project type has specific behavior:
- **Occasion**: Auto-suggest gift ideas, create prep subtasks, set annual recurrence
- **Compliance**: Long lead times (90+ days), document attachment requirements, strict deadlines
- **Household**: Low-stock tracking, quick replenishment, recurring chores
- **Health**: Appointment reminders, medication schedules, follow-up chains
- **Travel**: Checklist templates, booking tracking, visa requirements
- **Planning**: Milestone-based, multi-step, collaborative by default

## Background Jobs (Inngest)

### Reminder Delivery Job
```typescript
// Runs on a schedule, checks for reminders due within the next window
// Delivers via push notification, email, or in-app notification
// Respects user notification preferences and digest mode
```

### Weekly Digest Job
```typescript
// Runs weekly (configurable day/time per user)
// Summarizes: completed items, upcoming deadlines, overdue items, partner activity
// Sends via email and/or in-app notification
```

### Recurring Task Job
```typescript
// Checks for recurring tasks whose next occurrence is due
// Creates new task instances based on recurrence rules
// Handles: daily, weekly, monthly, yearly, custom intervals
```

## Sync Layer (PowerSync)

The backend must support PowerSync's sync protocol:
- Define sync rules that respect workspace membership and visibility
- Implement conflict resolution (field-level last-write-wins for scalar fields)
- Support incremental sync (delta changes, not full refresh)
- Handle offline queue processing when devices reconnect

## API Security Checklist
- [ ] All endpoints require authentication (Clerk JWT validation)
- [ ] Workspace membership checked on every workspace-scoped query
- [ ] Visibility filters applied to all list/get queries
- [ ] Input validation via Zod on every mutation
- [ ] Rate limiting on write endpoints
- [ ] Audit logging for sensitive operations (workspace invite, privacy changes)
- [ ] No sensitive data in error responses
- [ ] Minimal data in push notification payloads

## Testing Expectations
- Integration tests for every router procedure
- Unit tests for all service methods
- Test the urgency calculation edge cases thoroughly
- Test visibility filtering (ensure private items never leak)
- Test reminder scheduling and escalation logic
- Mock external services (Clerk, Inngest, Supabase) at the boundary
