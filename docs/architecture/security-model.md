# Security Model

## Authentication

### Provider: Clerk
- JWT-based authentication
- Social login support (Google, Apple)
- Email/password as fallback
- Session management with automatic refresh

### Token Flow
```
Client → Clerk SDK → JWT Token → API Request (Authorization header) → Clerk middleware validates → Proceed
```

### API Middleware
```typescript
// Every API request goes through auth middleware
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  const session = await clerk.verifySession(ctx.req.headers.authorization);
  if (!session) throw new TRPCError({ code: 'UNAUTHORIZED' });
  
  const user = await getUserByClerkId(session.userId);
  return next({ ctx: { ...ctx, userId: user.id, clerkId: session.userId } });
});
```

## Authorization

### Workspace-Level Access Control
Every data access is scoped to a workspace. Users can only access data in workspaces they are members of.

```typescript
// Workspace middleware — runs after auth
const workspaceMiddleware = t.middleware(async ({ ctx, input, next }) => {
  const isMember = await checkWorkspaceMembership(ctx.userId, input.workspaceId);
  if (!isMember) throw new TRPCError({ code: 'FORBIDDEN' });
  return next({ ctx: { ...ctx, workspaceId: input.workspaceId } });
});
```

### Visibility Model
Three-tier visibility applied at the query level:

| Visibility | Owner Access | Partner Access |
|---|---|---|
| `shared` | Full read/write | Full read/write |
| `mine_visible` | Full read/write | Read-only |
| `private` | Full read/write | No access (invisible) |

```typescript
// Applied to every list/get query
function withVisibilityFilter(query, userId: string, workspaceId: string) {
  return query.where(
    or(
      eq(col.visibility, 'shared'),
      and(eq(col.visibility, 'mine_visible'), eq(col.workspaceId, workspaceId)),
      and(eq(col.visibility, 'private'), eq(col.ownerId, userId))
    )
  );
}
```

### Role-Based Permissions

| Role | Capabilities |
|---|---|
| `owner` | Full workspace management, invite/remove members, delete workspace |
| `member` | Full CRUD on own items, read access per visibility, cannot delete workspace |

## Data Privacy

### Sensitive Data Categories
1. **Personal identifiers**: Permit numbers, passport info, tax IDs (in compliance projects)
2. **Health information**: Appointments, medications (in health projects)
3. **Gift information**: Gift plans that should be private from partner
4. **Financial data**: Budgets, expenses, insurance details
5. **Relationship data**: Private notes, personal items

### Privacy Rules
- Private items are **never** included in partner's sync rules
- Push notifications contain **minimal data** (title only, no sensitive details)
- Search results respect visibility (private items excluded from partner's search)
- Activity feed hides private item details from non-owners
- Export/backup includes only items visible to the requesting user

## Encryption

### In Transit
- All API communication over HTTPS (TLS 1.3)
- WebSocket connections encrypted
- PowerSync sync channel encrypted

### At Rest
- PostgreSQL: Supabase managed encryption (AES-256)
- Supabase Storage: Encrypted at rest
- Local RxDB/SQLite: Device-level encryption (OS-managed)
- Backups: Encrypted

## Input Validation

All API inputs validated with Zod schemas before processing:
```typescript
const CreateProjectSchema = z.object({
  workspaceId: z.string().uuid(),
  type: z.enum(['occasion', 'compliance', 'household', 'health', 'travel', 'planning', 'general']),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  visibility: z.enum(['shared', 'mine_visible', 'private']).default('shared'),
  dueDate: z.string().datetime().optional(),
  // ... other fields
});
```

## Rate Limiting

| Endpoint Category | Rate Limit |
|---|---|
| Read queries | 100 req/min per user |
| Write mutations | 30 req/min per user |
| Search | 20 req/min per user |
| Auth endpoints | 10 req/min per IP |
| File upload | 10 req/min per user |

## Audit Trail

All mutations are logged in `activity_events`:
- Who performed the action
- What entity was affected
- What changed (old → new values for updates)
- When it happened
- Used for activity feed, debugging, and future undo feature

## Security Checklist

- [ ] JWT validation on every request
- [ ] Workspace membership check on every workspace-scoped operation
- [ ] Visibility filtering on every query
- [ ] Zod validation on every mutation input
- [ ] Rate limiting enabled
- [ ] CORS restricted to known origins
- [ ] No secrets in client-side code
- [ ] Minimal push notification content
- [ ] Private items excluded from partner sync
- [ ] Encrypted connections (TLS)
- [ ] Encrypted storage (at rest)
- [ ] Audit logging for all mutations
- [ ] Regular dependency vulnerability scanning
