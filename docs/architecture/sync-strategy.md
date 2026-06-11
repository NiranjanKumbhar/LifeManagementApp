# Sync Strategy — Local-First Architecture

## Why Local-First?

From the blueprint: *"A life-management app is often used at the exact moments when reliability matters most: in a supermarket, on the way to an appointment, during travel, or when acting on a deadline."*

Local-first means:
- **Reads** always come from the local database — instant, no loading spinners
- **Writes** go to the local database first — instant confirmation
- **Sync** happens in the background — transparent to the user
- **Offline** is fully supported — the app works without connectivity

## Sync Stack

```
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│   RxDB       │  ←sync→  │  PowerSync   │  ←sync→  │  PostgreSQL  │
│  (on device) │          │  (sync layer) │          │  (Supabase)  │
└──────────────┘          └──────────────┘          └──────────────┘
```

- **RxDB**: Reactive local database with SQLite adapter on device
- **PowerSync**: Manages bidirectional sync between local and cloud
- **PostgreSQL**: Source of truth in the cloud

## Sync Rules (PowerSync Configuration)

```yaml
# powersync/sync-rules.yaml
bucket_definitions:
  # Workspace data — syncs to all members of the workspace
  workspace_data:
    parameters:
      - SELECT ws.id AS workspace_id
        FROM workspaces ws
        JOIN workspace_members wm ON ws.id = wm.workspace_id
        WHERE wm.user_id = token_parameters.user_id
    data:
      # Projects — filter by visibility
      - SELECT * FROM projects
        WHERE workspace_id = bucket.workspace_id
        AND (
          visibility = 'shared'
          OR visibility = 'mine_visible'
          OR (visibility = 'private' AND owner_id = token_parameters.user_id)
        )
      # Tasks — inherit project visibility
      - SELECT t.* FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE p.workspace_id = bucket.workspace_id
        AND (
          p.visibility = 'shared'
          OR p.visibility = 'mine_visible'
          OR (p.visibility = 'private' AND p.owner_id = token_parameters.user_id)
        )
      # Household items — always shared within workspace
      - SELECT * FROM household_items
        WHERE workspace_id = bucket.workspace_id
      # People — always shared within workspace
      - SELECT * FROM people
        WHERE workspace_id = bucket.workspace_id
      # Reminders — only user's own
      - SELECT * FROM reminders
        WHERE user_id = token_parameters.user_id
      # Notifications — only user's own
      - SELECT * FROM notifications
        WHERE user_id = token_parameters.user_id
```

## Conflict Resolution

### Strategy: Field-Level Last-Write-Wins (LWW)

For most scalar fields, the last write wins based on `updated_at` timestamp:

```typescript
// Conflict resolution rules
const conflictRules = {
  // Scalar fields: last write wins
  'project.title': 'lww',
  'project.description': 'lww',
  'project.status': 'lww',
  'project.priority': 'lww',
  'project.due_date': 'lww',
  
  // Completion: completed wins (if either partner marked it done, it's done)
  'task.status': 'completed_wins',
  
  // List operations: merge both changes
  'household_items': 'merge_additions',
  
  // Sort order: last write wins (minor visual issue, acceptable)
  'task.sort_order': 'lww',
};
```

### Special Cases

1. **Task completion**: If Partner A completes a task while Partner B edits it, completion wins
2. **Grocery list additions**: Both partners' additions are preserved (merge, not overwrite)
3. **Sort order conflicts**: Last write wins — minor visual reordering is acceptable
4. **Project archive**: Archive action wins over edits (if someone archived, respect that)

## Offline Queue

When offline, mutations queue locally:

```typescript
interface OfflineMutation {
  id: string;
  entity: string;         // 'project', 'task', etc.
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: string;       // ISO 8601
  synced: boolean;
}
```

- Queue is processed FIFO when connectivity returns
- Failed syncs retry with exponential backoff
- UI shows pending sync count (subtle badge)
- User can force-sync manually (pull to refresh)

## UI Sync Indicators

- **Online**: No indicator (default state)
- **Syncing**: Subtle animated dot in status bar
- **Offline**: Small "offline" chip, non-alarming
- **Pending changes**: Badge showing count of unsynced mutations
- **Conflict resolved**: Toast notification explaining what happened

## Performance Targets

- Local read latency: < 50ms
- Write to local DB: < 20ms
- Sync round-trip (online): < 2 seconds
- Offline queue processing: < 5 seconds per batch
- Initial sync (fresh install): < 10 seconds for typical workspace
