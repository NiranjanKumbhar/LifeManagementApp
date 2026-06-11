# Coding Conventions

## TypeScript

- **Strict mode** enabled everywhere (`strict: true` in tsconfig)
- **No `any`** — use `unknown` and narrow with type guards if needed
- **Explicit return types** on exported functions
- **Prefer `interface` over `type`** for object shapes (unless you need unions)
- **Use `const` assertions** for literal types: `as const`

## Naming

| Entity | Convention | Example |
|---|---|---|
| Files (utility) | `kebab-case.ts` | `date-utils.ts` |
| Files (component) | `PascalCase.tsx` | `TaskCard.tsx` |
| Variables / functions | `camelCase` | `calculateUrgency()` |
| Types / interfaces | `PascalCase` | `ProjectType`, `CreateTaskInput` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_LEAD_TIME_DAYS` |
| Database columns | `snake_case` | `due_date`, `owner_id` |
| CSS classes | `kebab-case` | `.task-card`, `.urgency-badge` |
| API routes (tRPC) | `camelCase` | `project.create`, `task.complete` |
| Enum values | `snake_case` | `'mine_visible'`, `'on_track'` |

## React Components

### File Structure
Every component follows co-location:
```
ComponentName/
├── ComponentName.tsx         # Component implementation
├── ComponentName.test.tsx    # Tests
├── ComponentName.module.css  # Styles (CSS Module)
└── index.ts                  # Barrel export
```

### Component Pattern
```tsx
interface TaskCardProps {
  task: Task;
  onComplete: (taskId: string) => void;
  variant?: 'compact' | 'detailed';
}

export function TaskCard({ task, onComplete, variant = 'compact' }: TaskCardProps) {
  // Hooks first
  // Derived state / computed values
  // Event handlers
  // Render
}
```

### Rules
- Functional components only (no class components)
- Named exports (except Next.js pages which use default export)
- Props must be explicitly typed with an interface
- Destructure props in the function signature
- Hooks at the top of the component
- No inline styles — use CSS Modules

## Imports

### Order
```typescript
// 1. React / framework imports
import { useState, useCallback } from 'react';

// 2. Third-party libraries
import { z } from 'zod';

// 3. Internal packages
import type { Project } from '@lifesync/shared-types';
import { Button, Card } from '@lifesync/ui';

// 4. Relative imports (parent directories first)
import { useWorkspace } from '@/lib/hooks';
import styles from './ProjectCard.module.css';
```

### Aliases
- `@/` — points to `src/` within each app
- `@lifesync/shared-types` — shared type package
- `@lifesync/ui` — shared component library

## Error Handling

### Backend — Result Pattern
```typescript
type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

// Usage
const result = await ProjectService.create(db, userId, input);
if (!result.success) {
  throw new TRPCError({ code: mapErrorCode(result.error.code), message: result.error.message });
}
return result.data;
```

### Frontend — Error Boundaries
- Wrap route segments with error boundaries
- Show user-friendly error messages
- Log errors to monitoring (Sentry)
- Never show raw error messages to users

## Git Workflow

### Branches
- `main` — production-ready code
- `develop` — integration branch
- `feat/*` — feature branches
- `fix/*` — bug fix branches
- `chore/*` — maintenance branches

### Commits
Follow Conventional Commits:
```
feat(dashboard): add urgency sorting to today block
fix(reminders): prevent duplicate reminder scheduling
docs(api): update project router contract
chore(deps): upgrade tRPC to v11.1
test(household): add low-stock tracking tests
refactor(tasks): extract hierarchy utils to shared package
```

### PR Requirements
- Descriptive title following commit convention
- Description of what and why
- Test plan (what was tested, how)
- Screenshots for UI changes
- All CI checks pass
- At least one review approval
