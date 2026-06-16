# Shared Types Package — @lifesync/shared-types

## Purpose

This package is the **single source of truth** for all TypeScript type definitions shared across the monorepo. Every app and package imports types from here — no type duplication allowed.

## Directory Structure

```
src/
├── index.ts                  # Barrel export
├── entities/                 # Core entity types
│   ├── workspace.ts          # Workspace, WorkspaceMember
│   ├── user.ts               # User, UserPreferences
│   ├── project.ts            # Project, ProjectType, ProjectStatus
│   ├── task.ts               # Task, TaskStatus, TaskHierarchy
│   ├── reminder.ts           # Reminder, ReminderType, Severity
│   ├── household.ts          # HouseholdItem, StockStatus
│   ├── person.ts             # Person, Relationship
│   ├── resource.ts           # Resource (attachment)
│   ├── activity.ts           # ActivityEvent
│   └── notification.ts       # Notification
├── api/                      # API request/response types
│   ├── inputs.ts             # Create/Update input types (mirrors Zod schemas)
│   ├── outputs.ts            # API response shapes
│   └── dashboard.ts          # DashboardData type
└── enums/                    # Shared enumerations
    ├── project-type.ts       # ProjectType enum
    ├── visibility.ts         # Visibility enum
    ├── urgency.ts            # UrgencyLevel enum
    ├── priority.ts           # Priority enum
    └── status.ts             # Various status enums
```

## Rules

- **Zero runtime dependencies** — this package is types-only
- **No logic** — only type definitions, interfaces, enums, and constants
- **All types exported from `index.ts`** — consumers import from `@lifesync/shared-types`
- **Breaking changes require coordination** — changing a type affects all packages
- **Use `interface` for entity shapes**, `type` for unions and derived types
- **Use string literal unions or enums** for constrained values — never bare strings

## Conventions

```typescript
// Entity interface pattern
export interface Project {
  id: string;
  workspaceId: string;
  type: ProjectType;
  title: string;
  status: ProjectStatus;
  // ... all fields from the database schema
}

// Input type pattern (for API mutations)
export interface CreateProjectInput {
  workspaceId: string;
  type: ProjectType;
  title: string;
  // ... only the fields the user provides
}

// Enum pattern
export type ProjectType = 'occasion' | 'compliance' | 'household' | 'health' | 'travel' | 'planning' | 'general';
export type Visibility = 'shared' | 'private';
export type UrgencyLevel = 'overdue' | 'critical' | 'soon' | 'on_track' | 'no_deadline';
```

## Build

```bash
pnpm build --filter=@lifesync/shared-types
```

This must run before other packages can resolve types.
