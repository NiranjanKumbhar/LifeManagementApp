# Data Model Documentation

> **Owner:** Database Agent
> **Last Updated:** Initial design
> **Reference:** See `docs/agents/database-agent.md` for full schema SQL

## Entity Relationship Overview

```
Workspace ──┬── WorkspaceMember ── User
            ├── Project ──┬── Task (hierarchical via parent_id)
            │             ├── Reminder
            │             └── Resource (attachments)
            ├── HouseholdItem
            ├── Person
            ├── ActivityEvent
            └── Notification
```

## Core Entities

### Workspace
The top-level container. A couple shares one workspace.
- Contains all projects, tasks, people, and household items
- Multi-workspace support allows future expansion (e.g., family + work)

### User
An authenticated person. Connected to a workspace via WorkspaceMember.
- Stores notification preferences, timezone, display name
- Linked to Clerk for authentication

### Project
The central organizational unit. Every meaningful life task belongs to a project.
- **Typed**: `occasion | compliance | household | health | travel | planning | general`
- **Visibility**: `shared | mine_visible | private`
- **Type-specific fields** stored in `custom_fields` (JSONB)
- **Deadline-aware**: `due_date`, `earliest_action_date`, `lead_time_days` as indexed columns

### Task
A unit of work within a project. Supports nesting via `parent_id`.
- **Hierarchical**: `parent_id` + `path` (materialized path) + `sort_order`
- **Ownable**: Can be assigned to either partner
- **Dependency-aware**: Optional `depends_on_id` for task sequencing
- **Recurring**: `is_recurring` + `recurrence_rule` (JSONB) for repeating tasks

### Reminder
A scheduled notification tied to a project or task.
- **Types**: `standard | lead_time | escalation | recurring`
- **Severity**: `info | warning | urgent | critical`
- **Snoozeable**: `snoozed_until` for smart snooze
- Processed by Inngest background jobs

### HouseholdItem
Grocery and household supply tracking.
- **Status**: `stocked | low | out | on_list`
- **Auto-replenish**: Items flagged for automatic re-addition after purchase
- Sorted by category for grocery list UX

### Person
Family members, contacts, and service providers.
- Tracks birthdays, anniversaries, gift ideas
- Links to Occasion projects for birthday/anniversary planning

### Resource
File attachments (documents, receipts, images).
- Linked to projects, tasks, or people
- Stored in Supabase Storage, metadata in PostgreSQL

### ActivityEvent
Append-only audit log of all changes.
- Tracks who did what, when, and what changed
- Powers the activity feed and future undo functionality

### Notification
In-app notification records.
- Created by reminder jobs, partner actions, and system events
- Tracks read/unread state

## JSONB Custom Fields by Project Type

| Project Type | Custom Fields (in `custom_fields` JSONB) |
|---|---|
| **Occasion** | `{ event_date, gift_budget, gift_ideas, guests, venue, recurring_annually }` |
| **Compliance** | `{ document_type, issuing_authority, reference_number, renewal_date, documents_required }` |
| **Household** | `{ area, frequency, last_completed, supplies_needed }` |
| **Health** | `{ provider, appointment_type, medication, dosage, next_followup }` |
| **Travel** | `{ destination, departure_date, return_date, booking_refs, visa_required, packing_list }` |
| **Planning** | `{ budget, milestones, decision_deadline, options_considered }` |

## Indexing Strategy

All frequently-filtered columns have dedicated indexes:
- `workspace_id` — every query is workspace-scoped
- `status` — filter active vs. completed
- `due_date` — deadline sorting and urgency calculation
- `owner_id` — partner filtering
- `visibility` — authorization filtering
- `path` — subtree task queries
- `remind_at` — reminder job polling

## Sync Considerations

For PowerSync compatibility:
- All PKs are UUIDs (no auto-increment to avoid conflict)
- All tables have `updated_at` for incremental sync
- Sync rules filter by `workspace_id` to scope data per device
- Visibility-aware sync: private items only sync to owner's devices
