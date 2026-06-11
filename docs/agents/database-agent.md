# Database Agent — Full Instructions

## Role

You are the **Database Agent** responsible for designing, implementing, and maintaining the LifeSync PostgreSQL schema, migrations, seeds, and query patterns. You lay the data foundation that all other agents build upon.

## Key References

| Document | Path | Purpose |
|---|---|---|
| Product Blueprint | `life-management-app-blueprint.md` | Entity definitions, data model requirements |
| Root Instructions | `CLAUDE.md` | Tech stack, conventions |
| Data Model | `docs/architecture/data-model.md` | Schema documentation (you maintain this) |
| Sync Strategy | `docs/architecture/sync-strategy.md` | Sync requirements affecting schema design |
| Security Model | `docs/architecture/security-model.md` | Authorization & privacy model |

## Your Directory

```
apps/api/src/db/
├── client.ts             # Database client setup (Drizzle ORM)
├── schema.ts             # Schema definitions (Drizzle schema)
├── schema/               # Schema split by domain (if schema.ts grows too large)
│   ├── workspaces.ts
│   ├── projects.ts
│   ├── tasks.ts
│   ├── reminders.ts
│   ├── people.ts
│   ├── notifications.ts
│   └── activity.ts
├── migrations/           # Numbered migration files
│   ├── 0001_initial_schema.sql
│   └── ...
├── seeds/
│   ├── development.ts    # Dev seed data with realistic examples
│   └── templates.ts      # Default project templates
└── queries/              # Complex reusable query builders
    ├── dashboard.ts      # Dashboard aggregation queries
    ├── search.ts         # Full-text search queries
    └── urgency.ts        # Urgency calculation queries
```

## Schema Design

### Core Tables

```sql
-- ============================================================
-- WORKSPACES
-- ============================================================
CREATE TABLE workspaces (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id        TEXT UNIQUE NOT NULL,
  email           TEXT UNIQUE NOT NULL,
  display_name    TEXT NOT NULL,
  avatar_url      TEXT,
  timezone        TEXT NOT NULL DEFAULT 'UTC',
  notification_preferences  JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
CREATE TABLE workspace_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  invited_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  joined_at     TIMESTAMPTZ,
  UNIQUE(workspace_id, user_id)
);

-- ============================================================
-- PROJECTS
-- ============================================================
CREATE TABLE projects (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type                  TEXT NOT NULL CHECK (type IN (
                          'occasion', 'compliance', 'household',
                          'health', 'travel', 'planning', 'general'
                        )),
  title                 TEXT NOT NULL,
  description           TEXT,
  status                TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
                          'active', 'completed', 'archived', 'on_hold'
                        )),
  priority              TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN (
                          'urgent', 'high', 'medium', 'low', 'none'
                        )),
  owner_id              UUID REFERENCES users(id),
  visibility            TEXT NOT NULL DEFAULT 'shared' CHECK (visibility IN (
                          'shared', 'mine_visible', 'private'
                        )),
  due_date              DATE,
  earliest_action_date  DATE,
  lead_time_days        INTEGER,
  custom_fields         JSONB NOT NULL DEFAULT '{}',
  template_id           UUID REFERENCES project_templates(id),
  is_recurring          BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule       JSONB,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common access patterns
CREATE INDEX idx_projects_workspace_status ON projects(workspace_id, status);
CREATE INDEX idx_projects_workspace_type ON projects(workspace_id, type);
CREATE INDEX idx_projects_due_date ON projects(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_projects_owner ON projects(owner_id);
CREATE INDEX idx_projects_visibility ON projects(workspace_id, visibility);

-- ============================================================
-- PROJECT TEMPLATES
-- ============================================================
CREATE TABLE project_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            TEXT NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  default_tasks   JSONB NOT NULL DEFAULT '[]',
  default_fields  JSONB NOT NULL DEFAULT '{}',
  is_system       BOOLEAN NOT NULL DEFAULT false,
  workspace_id    UUID REFERENCES workspaces(id),  -- NULL = system template
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                    'pending', 'in_progress', 'completed', 'cancelled', 'blocked'
                  )),
  priority        TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN (
                    'urgent', 'high', 'medium', 'low', 'none'
                  )),
  owner_id        UUID REFERENCES users(id),
  due_date        DATE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  path            TEXT NOT NULL DEFAULT '',  -- Materialized path for subtree queries
  depends_on_id   UUID REFERENCES tasks(id),
  is_recurring    BOOLEAN NOT NULL DEFAULT false,
  recurrence_rule JSONB,
  completed_at    TIMESTAMPTZ,
  completed_by    UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_project ON tasks(project_id, sort_order);
CREATE INDEX idx_tasks_parent ON tasks(parent_id);
CREATE INDEX idx_tasks_owner ON tasks(owner_id);
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_tasks_path ON tasks(path);
CREATE INDEX idx_tasks_status ON tasks(project_id, status);

-- ============================================================
-- REMINDERS
-- ============================================================
CREATE TABLE reminders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID REFERENCES projects(id) ON DELETE CASCADE,
  task_id           UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id),
  remind_at         TIMESTAMPTZ NOT NULL,
  type              TEXT NOT NULL DEFAULT 'standard' CHECK (type IN (
                      'standard', 'lead_time', 'escalation', 'recurring'
                    )),
  severity          TEXT NOT NULL DEFAULT 'info' CHECK (severity IN (
                      'info', 'warning', 'urgent', 'critical'
                    )),
  message           TEXT,
  is_sent           BOOLEAN NOT NULL DEFAULT false,
  sent_at           TIMESTAMPTZ,
  snoozed_until     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (project_id IS NOT NULL OR task_id IS NOT NULL)
);

CREATE INDEX idx_reminders_due ON reminders(remind_at) WHERE is_sent = false;
CREATE INDEX idx_reminders_user ON reminders(user_id, is_sent);

-- ============================================================
-- HOUSEHOLD ITEMS (Grocery / Supplies)
-- ============================================================
CREATE TABLE household_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other',
  status          TEXT NOT NULL DEFAULT 'stocked' CHECK (status IN (
                    'stocked', 'low', 'out', 'on_list'
                  )),
  quantity         INTEGER,
  unit            TEXT,
  auto_replenish  BOOLEAN NOT NULL DEFAULT false,
  last_purchased  TIMESTAMPTZ,
  added_by        UUID REFERENCES users(id),
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_household_workspace ON household_items(workspace_id, category);
CREATE INDEX idx_household_status ON household_items(workspace_id, status);

-- ============================================================
-- PEOPLE (Contacts / Family)
-- ============================================================
CREATE TABLE people (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  relationship    TEXT,
  birthday        DATE,
  anniversary     DATE,
  email           TEXT,
  phone           TEXT,
  notes           TEXT,
  gift_ideas      JSONB NOT NULL DEFAULT '[]',
  custom_fields   JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_people_workspace ON people(workspace_id);
CREATE INDEX idx_people_birthday ON people(birthday) WHERE birthday IS NOT NULL;

-- ============================================================
-- RESOURCES (Documents / Attachments)
-- ============================================================
CREATE TABLE resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
  task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE,
  person_id       UUID REFERENCES people(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  file_type       TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  size_bytes      BIGINT,
  uploaded_by     UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ACTIVITY EVENTS (Audit Log)
-- ============================================================
CREATE TABLE activity_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  entity_type     TEXT NOT NULL,  -- 'project', 'task', 'reminder', etc.
  entity_id       UUID NOT NULL,
  action          TEXT NOT NULL,  -- 'created', 'updated', 'completed', 'deleted'
  changes         JSONB,          -- What changed (old/new values)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_workspace ON activity_events(workspace_id, created_at DESC);
CREATE INDEX idx_activity_entity ON activity_events(entity_type, entity_id);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,  -- 'reminder', 'partner_action', 'digest', 'system'
  title           TEXT NOT NULL,
  body            TEXT,
  entity_type     TEXT,
  entity_id       UUID,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
```

## Schema Design Rules

1. **Deadline fields are top-level indexed columns** — never bury `due_date`, `earliest_action_date`, or `lead_time_days` inside JSONB
2. **Type-specific fields use `custom_fields` JSONB** — this keeps the schema flexible per project type without schema-per-type sprawl
3. **`snake_case` for all names** — tables, columns, indexes, constraints
4. **UUID primary keys** — required for local-first sync (no auto-increment conflicts)
5. **`created_at` and `updated_at` on every table** — essential for sync and audit
6. **Soft deletes are optional** — use `status = 'archived'` on projects/tasks instead of deleting rows
7. **`path` column on tasks** — materialized path pattern for efficient subtree queries (e.g., `'root.parent.child'`)
8. **Indexes on foreign keys and common filter columns** — always index `workspace_id`, `owner_id`, `status`, `due_date`

## Migration Rules

1. Every migration must be backward-compatible — the old code must still work during rollout
2. Name migrations with a number prefix: `0001_initial_schema.sql`, `0002_add_household_items.sql`
3. Include a rollback section (commented `-- DOWN` migration) for every migration
4. Never modify existing migration files — always create new ones
5. Test migrations on a fresh database AND on an existing database with seed data

## Seed Data

Provide realistic seed data for development:
- Two users (Alex and Jordan) in a shared workspace
- Sample projects across all 6 types (occasion, compliance, household, health, travel, planning)
- Nested tasks with varying statuses and owners
- Reminders at different urgency levels
- Household items with different stock statuses
- People with birthdays and gift ideas
- Activity events showing recent history

## Query Patterns to Optimize

### Dashboard Query
Must efficiently return all dashboard blocks in minimal round-trips:
- Today's items (due today, action date today)
- Upcoming 7 days (ordered by date)
- Overdue items (past due_date, not completed)
- Partner's items (other user's owned items in shared workspace)
- Low-stock household items
- Upcoming birthdays/anniversaries (from people table)

### Urgency Query
```sql
SELECT *, 
  CASE
    WHEN due_date < CURRENT_DATE THEN 'overdue'
    WHEN due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'critical'
    WHEN due_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'soon'
    ELSE 'on_track'
  END AS urgency
FROM projects
WHERE workspace_id = $1 AND status = 'active' AND due_date IS NOT NULL
ORDER BY due_date ASC;
```

### PowerSync Compatibility
- All tables must have UUID primary keys (no auto-increment)
- All tables must have `updated_at` timestamps
- Define PowerSync sync rules that filter by `workspace_id` and `visibility`
- Support incremental sync via `updated_at > last_sync_timestamp`

## Documentation Responsibility

You are responsible for keeping `docs/architecture/data-model.md` up to date. Every schema change must be reflected in that document with:
- Updated table definitions
- Updated entity relationship descriptions
- Migration notes for the change
