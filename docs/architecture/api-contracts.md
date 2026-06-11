# API Contracts

> **Owner:** Backend Agent (producer) + Frontend Agent & Mobile Agent (consumers)
> **Protocol:** tRPC v11 over HTTP
> **Base Types:** All types defined in `@lifesync/shared-types`

## Router Structure

```typescript
// Root router — apps/api/src/routers/index.ts
const appRouter = router({
  workspace: workspaceRouter,
  project: projectRouter,
  task: taskRouter,
  reminder: reminderRouter,
  household: householdRouter,
  person: personRouter,
  notification: notificationRouter,
  resource: resourceRouter,
  template: templateRouter,
  search: searchRouter,
  activity: activityRouter,
  user: userRouter,
});
```

## Workspace Router

| Procedure | Type | Input | Output | Description |
|---|---|---|---|---|
| `workspace.get` | query | `{ id }` | `Workspace` | Get workspace details |
| `workspace.create` | mutation | `{ name }` | `Workspace` | Create new workspace |
| `workspace.invite` | mutation | `{ workspaceId, email }` | `Invite` | Invite partner |
| `workspace.members` | query | `{ workspaceId }` | `Member[]` | List workspace members |

## Project Router

| Procedure | Type | Input | Output | Description |
|---|---|---|---|---|
| `project.list` | query | `{ workspaceId, type?, status?, ownerId? }` | `Project[]` | List projects with filters |
| `project.get` | query | `{ id }` | `ProjectWithTasks` | Get project with nested tasks |
| `project.create` | mutation | `CreateProjectInput` | `Project` | Create project (optionally from template) |
| `project.update` | mutation | `UpdateProjectInput` | `Project` | Update project fields |
| `project.complete` | mutation | `{ id }` | `Project` | Mark project complete |
| `project.archive` | mutation | `{ id }` | `Project` | Archive project |
| `project.dashboard` | query | `{ workspaceId }` | `DashboardData` | Get all dashboard blocks |

## Task Router

| Procedure | Type | Input | Output | Description |
|---|---|---|---|---|
| `task.list` | query | `{ projectId }` | `Task[]` | List tasks in project (tree structure) |
| `task.create` | mutation | `CreateTaskInput` | `Task` | Create task (optionally nested) |
| `task.update` | mutation | `UpdateTaskInput` | `Task` | Update task fields |
| `task.complete` | mutation | `{ id }` | `Task` | Mark task complete |
| `task.reorder` | mutation | `{ projectId, taskId, newOrder }` | `void` | Reorder tasks |
| `task.move` | mutation | `{ taskId, newProjectId }` | `Task` | Move task to different project |

## Reminder Router

| Procedure | Type | Input | Output | Description |
|---|---|---|---|---|
| `reminder.list` | query | `{ userId, includeSent? }` | `Reminder[]` | List reminders for user |
| `reminder.create` | mutation | `CreateReminderInput` | `Reminder` | Create custom reminder |
| `reminder.snooze` | mutation | `{ id, snoozeUntil }` | `Reminder` | Snooze a reminder |
| `reminder.dismiss` | mutation | `{ id }` | `void` | Dismiss a reminder |

## Household Router

| Procedure | Type | Input | Output | Description |
|---|---|---|---|---|
| `household.list` | query | `{ workspaceId, status?, category? }` | `HouseholdItem[]` | List household items |
| `household.add` | mutation | `CreateHouseholdItemInput` | `HouseholdItem` | Add item to list |
| `household.update` | mutation | `UpdateHouseholdItemInput` | `HouseholdItem` | Update item |
| `household.purchase` | mutation | `{ id }` | `HouseholdItem` | Mark item as purchased |
| `household.restock` | mutation | `{ id }` | `HouseholdItem` | Mark item as needing restock |

## Person Router

| Procedure | Type | Input | Output | Description |
|---|---|---|---|---|
| `person.list` | query | `{ workspaceId }` | `Person[]` | List all people |
| `person.get` | query | `{ id }` | `PersonWithProjects` | Get person with linked projects |
| `person.create` | mutation | `CreatePersonInput` | `Person` | Add a person |
| `person.update` | mutation | `UpdatePersonInput` | `Person` | Update person details |

## Notification Router

| Procedure | Type | Input | Output | Description |
|---|---|---|---|---|
| `notification.list` | query | `{ userId, unreadOnly? }` | `Notification[]` | List notifications |
| `notification.markRead` | mutation | `{ id }` | `void` | Mark as read |
| `notification.markAllRead` | mutation | `{ userId }` | `void` | Mark all as read |

## Search Router

| Procedure | Type | Input | Output | Description |
|---|---|---|---|---|
| `search.query` | query | `{ workspaceId, query, type? }` | `SearchResult[]` | Full-text search |

## Activity Router

| Procedure | Type | Input | Output | Description |
|---|---|---|---|---|
| `activity.feed` | query | `{ workspaceId, limit?, cursor? }` | `ActivityEvent[]` | Paginated activity feed |

## Resource Router

| Procedure | Type | Input | Output | Description |
|---|---|---|---|---|
| `resource.list` | query | `{ projectId?, taskId?, personId? }` | `Resource[]` | List attachments for an entity |
| `resource.upload` | mutation | `{ entityType, entityId, name, fileType, storageUrl, sizeBytes }` | `Resource` | Register an uploaded file |
| `resource.delete` | mutation | `{ id }` | `void` | Delete a resource record and its storage object |

## Template Router

| Procedure | Type | Input | Output | Description |
|---|---|---|---|---|
| `template.list` | query | `{ workspaceId, type? }` | `ProjectTemplate[]` | List system + workspace templates |
| `template.get` | query | `{ id }` | `ProjectTemplate` | Get template with default tasks |
| `template.create` | mutation | `CreateTemplateInput` | `ProjectTemplate` | Create a custom workspace template |
| `template.update` | mutation | `UpdateTemplateInput` | `ProjectTemplate` | Update a custom template |
| `template.delete` | mutation | `{ id }` | `void` | Delete a custom workspace template (system templates cannot be deleted) |

## User Router

| Procedure | Type | Input | Output | Description |
|---|---|---|---|---|
| `user.me` | query | — | `User` | Get current user profile |
| `user.updateProfile` | mutation | `UpdateProfileInput` | `User` | Update profile settings |
| `user.updateNotificationPrefs` | mutation | `NotificationPrefsInput` | `User` | Update notification preferences |

## Dashboard Data Shape

```typescript
interface DashboardData {
  todayItems: (Project | Task)[];        // Due today or action date today
  upcoming7Days: (Project | Task)[];     // Due within 7 days
  overdue: (Project | Task)[];           // Past due, not completed
  waitingOnPartner: (Project | Task)[];  // Owned by partner, shared visibility
  lowStockItems: HouseholdItem[];        // Status = 'low' or 'out'
  upcomingDates: Person[];               // Birthdays/anniversaries in next 30 days
  recentlyCompleted: (Project | Task)[]; // Completed in last 7 days
}
```

## Error Response Format

All errors follow this shape:
```typescript
interface ApiError {
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'VALIDATION' | 'CONFLICT' | 'INTERNAL';
  message: string;
  details?: Record<string, unknown>;
}
```
