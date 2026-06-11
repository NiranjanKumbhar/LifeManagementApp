# Frontend Agent — Full Instructions

## Role

You are the **Frontend Agent** responsible for building the LifeSync web application using Next.js 15 (App Router) and the shared design system. Your goal is to create an interface that feels calm, warm, and trustworthy — not like enterprise software.

## Key References

| Document | Path | Purpose |
|---|---|---|
| Product Blueprint | `life-management-app-blueprint.md` | Requirements, UX, features |
| Root Instructions | `CLAUDE.md` | Tech stack, conventions, structure |
| API Contracts | `docs/architecture/api-contracts.md` | Backend endpoints you consume |
| Design System | `packages/ui/CLAUDE.md` | Shared component library |
| Web App | `apps/web/CLAUDE.md` | Web-specific instructions |

## Your Directories

```
packages/ui/src/          # Shared design system — components, tokens, hooks
apps/web/src/             # Next.js web application
├── app/                  # App Router — pages, layouts, route groups
├── components/           # Web-specific components (not shared)
├── lib/                  # tRPC client, providers, utilities
└── styles/               # Global CSS, CSS Modules, design tokens
```

## Design Philosophy

The blueprint states: *"The app should feel less like software and more like a calm, reliable shared memory."*

### Visual Design Principles
- **Color palette:** Warm, muted tones. Avoid harsh enterprise blues. Think soft teals, warm grays, gentle purples, and natural greens.
- **Typography:** Use a humanist sans-serif like Inter or Outfit. Generous line heights. Clear hierarchy.
- **Spacing:** Breathable layouts. Generous padding. Don't cram information.
- **Animation:** Subtle, purposeful micro-animations. Smooth transitions. Gentle completion celebrations.
- **Empty states:** Always design helpful empty states that guide the user to their next action.
- **Urgency hierarchy:** Overdue items use warm reds/oranges. Upcoming uses amber. On-track uses calm greens/teals. Make urgency feel informative, not stressful.

### Design Tokens (define in `packages/ui/src/tokens/`)
```typescript
// Color system — warm, calm, purposeful
const colors = {
  // Primary — calm teal
  primary: { 50: '...', 100: '...', /* ... */ 900: '...' },
  // Urgency — informative, not alarming
  urgency: {
    overdue: '...',     // Warm coral/red
    soon: '...',        // Soft amber
    onTrack: '...',     // Calm teal
    completed: '...',   // Gentle green
  },
  // Surfaces — warm grays, not cold
  surface: {
    background: '...',
    card: '...',
    elevated: '...',
    overlay: '...',
  },
  // Partner indicators
  partner: {
    self: '...',
    partner: '...',
    shared: '...',
  },
};
```

## Key Screens to Build (V1)

### 1. Dashboard (Home Screen)
The most important screen. Must answer within seconds:
- What needs attention today?
- What is at risk?
- What belongs to my partner?

**Blocks:**
- Needs action today
- Upcoming in next 7 days
- At risk / overdue
- Waiting on partner
- Household low stock
- Upcoming important dates
- Recently completed

### 2. Quick Capture
- Universal "+" button, always visible in the bottom nav or FAB
- Minimal required fields: just a text input
- Auto-detect project type from text (V2, but design the UI for it)
- Tap → type → enter in under 2 seconds

### 3. Inbox
- Unstructured captured items not yet assigned to a project
- Bulk triage actions: assign project, set date, assign owner
- Swipe gestures for quick actions

### 4. Project List & Detail
- Filterable by type (occasion, compliance, household, health, travel, planning)
- Each type gets a distinct icon and subtle color accent
- Project detail: nested tasks, timeline, ownership, custom fields
- Progress indicator per project

### 5. Household Module
- Grocery list with categories
- Low-stock indicators
- Quick add from common items
- Shared real-time sync (both partners see changes instantly)

### 6. Calendar View
- Month and week views
- Events, deadlines, and reminders overlaid
- Color-coded by project type
- Tap to drill into project/task

### 7. People
- Family contacts, service contacts
- Birthday/anniversary tracking tied to Occasion projects
- Gift ideas linked to people

### 8. Settings
- Notification preferences (lead times, digest frequency)
- Workspace management (invite partner)
- Privacy settings (default visibility)
- Theme preferences

## Component Architecture

### Shared Components (in `packages/ui/`)
Build these as the design system foundation:
- `Button` — primary, secondary, ghost, danger variants
- `Input` — text, date, select, multi-select
- `Card` — surface container with elevation levels
- `Badge` — urgency badges, status badges, owner badges
- `Avatar` — user avatars with partner indicator
- `Modal` — centered and bottom sheet variants
- `Toast` — success, error, info notifications
- `EmptyState` — illustration + message + CTA
- `TaskItem` — checkbox + text + metadata (due date, owner, urgency)
- `ProjectCard` — type icon + title + progress + urgency
- `UrgencyIndicator` — visual urgency indicator (overdue/soon/on-track)
- `QuickCapture` — the universal input component
- `PartnerBadge` — shows ownership (mine/partner/shared)

### Web-Specific Components (in `apps/web/src/components/`)
- `DashboardGrid` — responsive grid layout for dashboard blocks
- `NavigationSidebar` — left sidebar navigation (desktop)
- `BottomNav` — mobile bottom navigation
- `ProjectTypeFilter` — filter bar for project types
- `CalendarWidget` — monthly/weekly calendar component
- `GroceryList` — the household grocery list module
- `NotificationPanel` — notification center dropdown

## State Management

### tRPC Integration
```typescript
// apps/web/src/lib/trpc.ts
// Set up tRPC client with React Query integration
// Use optimistic updates for instant-feeling interactions
// Implement offline queue for local-first writes
```

### Local State
- Use React `useState`/`useReducer` for component-local state
- Use Zustand for client-side global state (UI state, filters, active views)
- Use React Query (via tRPC) for server/synced state
- For offline-first: RxDB reactive queries as the primary data source

## Accessibility Requirements
- WCAG 2.1 AA compliance minimum
- Keyboard navigation for all interactive elements
- Screen reader labels on all buttons and controls
- Focus management in modals and navigation
- Sufficient color contrast ratios
- `prefers-reduced-motion` support for animations

## Performance Targets
- First Contentful Paint < 1.5s
- Largest Contentful Paint < 2.5s
- Time to Interactive < 3s
- Core Web Vitals all "Good"
- Dashboard renders from local cache — no loading spinners for cached data
- Quick capture input focuses in < 100ms

## Testing Expectations
- Every component has a co-located `*.test.tsx` file
- Test rendering, user interactions, and edge cases
- Use `@testing-library/react` — test behavior, not implementation
- E2E tests for: quick capture flow, dashboard load, project CRUD, grocery list
