# Testing Agent — Full Instructions

## Role

You are the **Testing Agent** responsible for ensuring LifeSync's reliability, correctness, and confidence in deployments. You write and maintain tests across all layers — unit, integration, and end-to-end.

## Key References

| Document | Path | Purpose |
|---|---|---|
| Product Blueprint | `life-management-app-blueprint.md` | Features to validate |
| Root Instructions | `CLAUDE.md` | Tech stack, conventions |
| API Contracts | `docs/architecture/api-contracts.md` | API behavior to test |
| Data Model | `docs/architecture/data-model.md` | Schema constraints to validate |
| Security Model | `docs/architecture/security-model.md` | Authorization rules to test |

## Testing Stack

| Tool | Purpose | Scope |
|---|---|---|
| **Vitest** | Test runner & assertion library | Unit + Integration |
| **React Testing Library** | Component testing (web) | Frontend unit tests |
| **@testing-library/react-native** | Component testing (mobile) | Mobile unit tests |
| **Playwright** | Browser automation | E2E tests |
| **MSW (Mock Service Worker)** | API mocking for frontend tests | Frontend integration |
| **Supertest** | HTTP assertion for API tests | Backend integration |
| **Faker.js** | Realistic test data generation | All layers |

## Test Organization

```
# Tests are co-located with source files
apps/
├── web/src/
│   ├── components/
│   │   ├── TaskCard.tsx
│   │   └── TaskCard.test.tsx        # ← co-located
│   ├── lib/
│   │   ├── urgency.ts
│   │   └── urgency.test.ts          # ← co-located
│   └── e2e/                          # E2E tests for web
│       ├── dashboard.spec.ts
│       ├── quick-capture.spec.ts
│       ├── project-crud.spec.ts
│       ├── grocery-list.spec.ts
│       └── auth-flow.spec.ts
├── mobile/src/
│   ├── screens/
│   │   ├── DashboardScreen.tsx
│   │   └── DashboardScreen.test.tsx  # ← co-located
│   └── e2e/                          # E2E tests for mobile
│       └── ...
└── api/src/
    ├── services/
    │   ├── project.service.ts
    │   └── project.service.test.ts   # ← co-located
    ├── routers/
    │   ├── project.ts
    │   └── project.test.ts           # ← co-located
    └── __tests__/                     # Cross-cutting integration tests
        ├── setup.ts                  # Test database setup/teardown
        ├── factories/                # Test data factories
        │   ├── user.factory.ts
        │   ├── project.factory.ts
        │   ├── task.factory.ts
        │   └── workspace.factory.ts
        └── helpers/
            ├── auth.helper.ts        # Mock auth context
            └── db.helper.ts          # Test DB utilities
```

## Test Data Factories

Create factories for every core entity:
```typescript
// apps/api/src/__tests__/factories/project.factory.ts
import { faker } from '@faker-js/faker';
import type { CreateProjectInput } from '@lifesync/shared-types';

export function createProjectInput(
  overrides: Partial<CreateProjectInput> = {}
): CreateProjectInput {
  return {
    workspaceId: faker.string.uuid(),
    type: faker.helpers.arrayElement([
      'occasion', 'compliance', 'household', 'health', 'travel', 'planning'
    ]),
    title: faker.lorem.sentence(3),
    description: faker.lorem.paragraph(),
    status: 'active',
    priority: 'medium',
    visibility: 'shared',
    dueDate: faker.date.future().toISOString(),
    ...overrides,
  };
}
```

## V1 Critical Test Coverage

### Priority 1 — Must Have (blocks release)

#### Quick Capture Flow
```typescript
describe('Quick Capture', () => {
  test('creates a task from minimal text input');
  test('assigns to inbox when no project specified');
  test('respects default visibility setting');
  test('works offline and syncs when reconnected');
  test('shows confirmation feedback after creation');
});
```

#### Workspace & Partner Visibility
```typescript
describe('Workspace Visibility', () => {
  test('shared items visible to both partners');
  test('mine_visible items readable by partner, editable by owner');
  test('private items only visible to owner');
  test('partner cannot see private items in any query');
  test('visibility change propagates to notifications');
});
```

#### Deadline Intelligence & Urgency
```typescript
describe('Urgency Calculation', () => {
  test('overdue: due_date is in the past');
  test('critical: due_date within 7 days');
  test('soon: due_date within 30 days');
  test('on_track: due_date beyond 30 days');
  test('no_deadline: due_date is null');
  test('urgency updates when date changes');
  test('completed items have no urgency');
});
```

#### Reminder System
```typescript
describe('Reminder Scheduling', () => {
  test('creates lead-time reminders for compliance projects (90/60/30/7/1 days)');
  test('escalates severity as deadline approaches');
  test('respects snooze settings');
  test('delivers to correct partner based on ownership');
  test('does not send reminders for completed projects');
  test('digest mode batches reminders correctly');
});
```

#### Project CRUD
```typescript
describe('Project Operations', () => {
  test('creates project with type-specific defaults');
  test('applies template tasks on creation');
  test('updates project fields');
  test('completes project and marks all tasks done');
  test('archives project without deleting data');
  test('enforces workspace membership on all operations');
});
```

#### Grocery / Household
```typescript
describe('Household Module', () => {
  test('adds item to grocery list');
  test('marks item as purchased');
  test('tracks low-stock status');
  test('auto-replenish items reappear after purchase');
  test('real-time sync between partners');
  test('categorizes items correctly');
});
```

### Priority 2 — Should Have

#### Dashboard
```typescript
describe('Dashboard', () => {
  test('shows today items sorted by urgency');
  test('shows upcoming 7 days');
  test('shows overdue items prominently');
  test('shows partner waiting items');
  test('shows low-stock household items');
  test('shows upcoming birthdays/anniversaries');
  test('renders from cached data without network');
});
```

#### Task Hierarchy
```typescript
describe('Task Hierarchy', () => {
  test('creates nested subtasks');
  test('completing parent marks subtasks as completed');
  test('reorders tasks within a project');
  test('moves task between projects');
  test('path column updates on nesting changes');
});
```

#### Search
```typescript
describe('Search', () => {
  test('searches across projects and tasks');
  test('filters by project type');
  test('returns results ranked by relevance');
  test('handles empty query gracefully');
});
```

### Priority 3 — Nice to Have (V1)
- Calendar view rendering
- Activity feed accuracy
- People & gift idea management
- Notification panel interactions
- Settings persistence

## E2E Test Scenarios (Playwright)

```typescript
// apps/web/e2e/quick-capture.spec.ts
test('user can capture a task from any screen', async ({ page }) => {
  // 1. Log in as Alex
  // 2. Navigate to dashboard
  // 3. Click quick-capture button
  // 4. Type "Buy flowers for mom's birthday"
  // 5. Press Enter
  // 6. Verify task appears in inbox
  // 7. Verify partner (Jordan) can see the task
});

test('full project lifecycle', async ({ page }) => {
  // 1. Create a compliance project "Renew resident permit"
  // 2. Add subtasks: gather docs, fill form, book appointment, submit
  // 3. Set due date 90 days from now
  // 4. Verify reminders are scheduled
  // 5. Complete subtasks one by one
  // 6. Complete project
  // 7. Verify it moves to completed section
});
```

## Testing Rules

1. **No `any` in tests** — Test code follows the same TypeScript strictness
2. **No hardcoded IDs or timestamps** — Use factories and `faker`
3. **Test behavior, not implementation** — Don't test internal state, test user-visible outcomes
4. **Each bug fix gets a regression test** — Before fixing, write a test that fails
5. **Mock at boundaries** — Mock Clerk, Supabase, Inngest, not internal services
6. **Clean up after tests** — Each test is independent, no shared mutable state
7. **Tests must be fast** — Unit tests < 100ms each, integration < 500ms, E2E < 30s

## Coverage Targets

| Area | Target |
|---|---|
| `apps/api/src/services/` | > 80% |
| `apps/api/src/routers/` | > 70% |
| `apps/web/src/components/` | > 60% |
| `apps/web/src/lib/` | > 80% |
| `packages/shared-types/` | > 90% |
| Overall | > 70% |

## Commands
```bash
pnpm test                      # Run all tests
pnpm test --filter=api         # Run API tests only
pnpm test --filter=web         # Run web tests only
pnpm test:coverage             # Run with coverage report
pnpm test:e2e                  # Run Playwright E2E tests
pnpm test:watch                # Watch mode for development
```
