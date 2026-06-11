# Life Management App Blueprint

## Overview

This product is a shared life management app for couples that combines the speed of a grocery list app with the structure of a project system and the intelligence of a deadline-aware assistant. Existing productivity leaders each solve only part of the problem: Todoist is strong at fast capture and clean task management, Notion is flexible but requires heavy self-assembly, Asana is strong for team workflows, and household apps like Bring!, Maple, and FamilyWall are useful for narrow family or shopping use cases rather than full adult life administration.[cite:1][cite:20][cite:22][cite:27][cite:49][cite:54]

The product gap is the space between generic productivity and real household mental load. The app should help a couple remember, plan, delegate, and complete life responsibilities such as birthdays, renewals, groceries, travel planning, household maintenance, health follow-ups, and recurring obligations without forcing all of them into the same flat to-do list model.[cite:22][cite:25][cite:30]

## Product Positioning

### Core promise

The app should feel like a calm, organized partner who remembers everything, surfaces what matters at the right time, and reduces anxiety instead of creating more work. This is especially important because mental load in households is not just a task problem; it is an invisible coordination problem that existing tools only partially address.[cite:22][cite:25][cite:30]

### Competitive position

| Product | Main strength | Main weakness for this use case |
|---|---|---|
| Todoist | Fast capture, clean UX, natural-language task entry [cite:20] | Flat task structure, limited life-domain intelligence [cite:20] |
| Notion | Highly flexible workspace [cite:27] | Setup burden, self-assembly, weak opinionated life workflows [cite:27] |
| Asana | Structured collaboration and project workflows [cite:24] | Built for work teams, not couple life admin [cite:24] |
| Bring! | Very smooth shared grocery workflow, real-time list sync [cite:49][cite:54] | Flat grocery scope, no deadline intelligence or project typing [cite:49][cite:54] |
| Mental-load / family organizer apps | Shared household context, some family coordination [cite:22][cite:13] | Limited depth, limited structured workflows, weak compliance and urgency logic [cite:22][cite:13] |
| This app | Typed life projects, shared ownership, urgency-aware planning | Must avoid complexity and preserve fast capture |

## Product Principles

The product should follow six principles:

- Capture first, classify later. Fast entry matters more than perfect structure at the moment of capture, which aligns with why lightweight tools like Todoist remain sticky for users.[cite:20]
- Start from real-life situations, not project-management language. Users think in terms like “dad’s birthday,” “renew permit,” and “buy groceries,” not in abstract workflow terms.
- Shared by default, private when needed. A couple-facing app must support shared, visible-but-owned, and private items because real households contain all three categories.[cite:25][cite:30]
- Progressive complexity. The app should be immediately useful on day one and only reveal advanced structure as the user’s trust grows, which counters the setup fatigue seen in highly flexible tools.[cite:27]
- Deadline intelligence over static reminders. A resident permit renewal and a grocery refill should not be treated as the same type of task.
- Local speed over cloud dependency. The app should feel instantaneous on every tap, even on weak connections, which is why local-first architecture is strategically important.[cite:31][cite:34][cite:35]

## User Model

The primary user model is a couple managing shared life responsibilities with different ownership patterns, urgency types, and data shapes. The app is not just for checklists; it is for the hidden operational system of a household.

### Primary user needs

- Remember important personal and family dates.
- Plan ahead for legal, immigration, insurance, and renewal tasks.
- Track shopping and household stock.
- Split responsibility without losing shared visibility.
- See what matters now, this week, and later.
- Trust that the app will surface risks before they become problems.

## Information Architecture

### Primary navigation

The initial app navigation should focus on a small number of high-frequency surfaces:

- Inbox: quick capture for anything not yet structured.
- Today: actions that need attention now.
- Upcoming: deadlines, events, and reminders in time order.
- Projects: all structured life projects.
- Household: grocery, home, recurring chores, maintenance.
- People: family members, household roles, gift targets, service contacts.
- Calendar: date-oriented view across project types.
- Settings: reminders, workspace, privacy, notifications.

### Core entities

The best long-term structure is a hybrid project model rather than a flat task list, a pure tree, or a graph-first model. Graph databases are powerful for many-hop relationship traversal, but this product mainly needs efficient access to nested tasks, deadlines, ownership, and type-specific fields rather than deep graph analytics.[cite:37][cite:43]

Recommended entities:

- Workspace
- User
- Project
- Task
- Reminder
- Resource
- Person
- Activity event
- Notification
- Template

### Project types

Each project should have a base schema plus type-specific custom fields. Suggested starting types:

- Occasion: birthdays, anniversaries, gifts, events.
- Compliance: resident permit, passport, visa, tax, insurance, vehicle documents.
- Household: groceries, supplies, cleaning, maintenance, bills.
- Health: appointments, medication refills, follow-ups.
- Travel: bookings, visas, itineraries, prep lists.
- Shared planning: moving house, major purchases, couple goals.

## Feature Set

### V1 features

The initial version should focus on a narrow but powerful set of features that create everyday usefulness without overwhelming new users:

- Quick capture from anywhere.
- Shared workspace for a couple.
- Project creation using templates.
- Project detail pages with nested tasks.
- Shared and personal ownership states.
- Due dates, lead times, and reminder sequences.
- Dashboard showing urgent items, upcoming items, and blocked items.
- Grocery/household list module with low-stock tracking.
- Notifications with snooze and escalation.
- Basic activity history.
- Calendar and list views.
- Search across projects, tasks, notes, and people.

### V2 differentiators

Once the core flow is validated, the app can expand into the features that make it clearly stronger than generic productivity tools:

- Smart project-type detection from quick capture text.
- Suggested subtasks based on templates and history.
- Risk scoring, such as “deadline soon but no action started.”
- Load balancing insights across partners.
- Weekly shared digest.
- Dependents and family extensions beyond couples.
- Document storage for permits, receipts, IDs, insurance files.
- Contextual reminders such as “buy this when near store” or “do this when at home.”
- AI-assisted summarization of a project state.

## UX Design

### UX north star

The app should feel less like software and more like a calm, reliable shared memory. Existing apps succeed when friction is low and fail when setup and maintenance feel like extra work.[cite:20][cite:27]

### Highest-priority UX requirements

1. Capture speed must be near-instant, because this is the core stickiness driver in successful task products.[cite:20]
2. The home screen must answer, within seconds, what needs attention today, what is at risk, and what belongs to the other partner.
3. Each project type must feel purpose-built rather than like a generic task wrapper.
4. Shared and private visibility must be obvious and respectful of relationship dynamics.[cite:25][cite:30]
5. The app must reduce anxiety and cognitive load, not increase them.

### Key UX patterns

- One universal quick-add button, always visible.
- Minimal required fields during capture.
- Smart defaults and templates after capture.
- Strong urgency hierarchy: overdue, soon, on track.
- Human-centered language instead of work-management jargon.
- Designed empty states that suggest the next useful action.
- Multiple views over the same data: list, timeline, calendar, household module.
- Smooth completion feedback and subtle celebration for meaningful milestones.

### Dashboard design

The dashboard should be the app’s main value surface. It should not show every project equally; it should prioritize what matters. Recommended dashboard blocks:

- Needs action today.
- Upcoming in the next 7 days.
- At risk or overdue.
- Waiting on partner.
- Household low stock.
- Upcoming important dates.
- Recently completed.

### Notification design

Notifications are part of the product, not a secondary layer. Generic due-date pings are not sufficient for this use case.

The system should support:

- Lead-time reminders, such as 90, 60, 30, 7, and 1 days before a deadline.
- Escalating language and urgency based on remaining time.
- Partner-aware visibility without turning the app into a nagging system.
- Smart snooze options.
- Daily or weekly digest modes to avoid fatigue.

## Performance

### Performance strategy

The app’s smoothness should come from architecture, not just frontend optimization. Local-first systems write to a local database first and sync in the background, which makes the UI feel immediate and resilient offline.[cite:31][cite:34][cite:35][cite:46]

### Performance requirements

- Task/project creation should feel instant on the device.
- Core screens should render from local data, not block on network calls.
- Scroll performance must remain smooth with large project/task lists.
- Sync should be incremental, not full-refresh.
- Search should be fast and mostly local.
- Notifications should continue working predictably even when the user has been offline.

### Why local-first matters here

A life-management app is often used at the exact moments when reliability matters most: in a supermarket, on the way to an appointment, during travel, or when acting on a deadline. Local-first architecture keeps the app responsive and trustworthy under weak connectivity and also supports collaboration through background sync.[cite:31][cite:34][cite:35]

## Technical Architecture

### Recommended stack

A practical modern stack for this product is:

| Layer | Recommendation | Rationale |
|---|---|---|
| App frontend | React Native with Expo for mobile, Next.js for web | Strong TypeScript ecosystem, shared component model, mature mobile tooling, good fit for a modern consumer-facing app [cite:35][cite:36][cite:39][cite:42] |
| Local data | SQLite on device or RxDB | Low-latency local reads/writes, offline support, reactive local state [cite:34][cite:35] |
| Sync | ElectricSQL or PowerSync | Built for local-first synchronization on top of Postgres-style backends [cite:35][cite:46] |
| Backend API | TypeScript-based API layer such as tRPC/Node | Shared types, strong developer velocity |
| Cloud database | PostgreSQL | Reliable relational core, strong indexing, good support for deadlines, ownership, search, and analytics |
| Background jobs | Inngest or queue-based job runner | Reminder scheduling, recurring jobs, digest generation |
| Auth | Supabase Auth or Clerk | Easy invite and workspace onboarding |
| Storage | Object storage for documents and attachments | Permit scans, receipts, notes, images |
| Realtime | Postgres-backed realtime or sync layer | Partner updates and live collaboration |

### Why not a graph-first model

Graph databases are useful for highly connected, many-hop problems, but the dominant access patterns in this app are time-based queries, ownership filters, nested task retrieval, and project-type views rather than deep graph traversal.[cite:37][cite:43] A graph-style relationship layer can still exist conceptually, but the operational database should remain relational for simplicity and query efficiency.

### Best storage model

The strongest fit is a hybrid relational model:

- Core entities in relational tables.
- Type-specific project fields in JSONB.
- Tasks stored with `parent_id` plus a path or ordering strategy for nested retrieval.
- Activity stored as append-only events.
- Deadline and reminder fields stored in top-level indexed columns, not buried in JSON.

This gives flexibility without sacrificing query speed or integrity.

## Data Model Recommendation

### Core structure

Recommended top-level model:

- `workspaces`
- `users`
- `workspace_members`
- `projects`
- `project_templates`
- `tasks`
- `reminders`
- `resources`
- `people`
- `activity_events`
- `notifications`

### Project table pattern

`projects` should include standard columns such as:

- `id`
- `workspace_id`
- `type`
- `title`
- `status`
- `priority`
- `owner_id`
- `visibility`
- `due_date`
- `earliest_action_date`
- `lead_time_days`
- `custom_fields` (JSONB)
- `created_at`
- `updated_at`

### Task hierarchy

A pure tree is too rigid if the app eventually supports links between items, and a graph-first store is unnecessarily complex for the current scope. A practical solution is:

- `tasks.parent_id` for hierarchy
- `tasks.sort_order` for UI ordering
- `tasks.path` or equivalent denormalized path for efficient subtree reads
- optional `project_id` plus `depends_on_task_id` when needed later

This structure preserves nested tasks while keeping queries and rendering straightforward.

### Visibility model

The product should support three visibility states:

- Shared
- Mine but visible
- Private

This should be a first-class part of the schema and authorization logic, because it is central to the couple use case.[cite:25][cite:30]

## Sync and Conflict Handling

The app should assume both partners may edit the same data from different devices under unreliable connectivity. Local-first sync systems are specifically designed to keep such apps responsive while reconciling changes later.[cite:34][cite:35][cite:38]

Recommended rules:

- Device writes locally first.
- Changes sync as deltas in the background.
- Conflict policy should be deterministic, such as field-level last-write-wins for most scalar fields.
- List insertion and completion states should preserve both users’ changes where possible.
- Event history should preserve context for debugging and future undo features.

## Security and Privacy

Because the app deals with IDs, permits, personal routines, gifts, health reminders, and relationship-sensitive information, privacy needs to be part of the design from the beginning.

Key requirements:

- Strong workspace-level access control.
- Visibility-aware queries and notifications.
- Encryption in transit and at rest.
- Secure document storage.
- Auditability for changes.
- Minimal data exposure in push notifications.

## What makes the app stand out

This product stands out when it combines the best qualities of several categories without inheriting their biggest weaknesses:

- The speed and low friction of Todoist-style capture.[cite:20]
- The flexibility of Notion, but with opinionated defaults instead of blank-canvas setup.[cite:27]
- The collaboration of Asana-style shared work, but redesigned for personal life rather than office projects.[cite:24]
- The smooth household usefulness of Bring!, but expanded beyond grocery lists into full life management.[cite:49][cite:54]
- The mental-load awareness discussed in household-organization tools, but with deeper structure and urgency intelligence.[cite:22][cite:25][cite:30]

The differentiators should be clear:

- Project typing instead of one flat task system.
- Deadline intelligence instead of generic reminders.
- Shared visibility with accountability.
- Local-first responsiveness.
- Household, compliance, occasion, and planning workflows in one coherent product.

## Suggested roadmap

### Phase 1: prove the core loop

- Quick capture
- Shared couple workspace
- Typed projects
- Dashboard
- Nested tasks
- Reminder sequences
- Grocery/household list module

### Phase 2: deepen reliability and intelligence

- Better recurrence rules
- Weekly digest
- Risk scoring
- Smarter templates
- Search improvements
- Document attachments

### Phase 3: become the life operating system

- AI-assisted intake and summarization
- Load balancing insights
- Broader family support
- Contextual reminders
- Partner-specific personalization

## Final product standard

The product should be judged against a simple standard: it should make life feel more handled, not more managed. If the app is fast, warm, structured, trustworthy, and quietly intelligent, it can occupy a unique position between generic productivity tools and narrow household utilities.[cite:20][cite:22][cite:27][cite:49][cite:54]
