# Shared UI Package — @lifesync/ui

## Purpose

This is the **LifeSync design system** — a shared library of React components, design tokens, hooks, and utilities used by both the web and mobile apps.

## Directory Structure

```
src/
├── index.ts                     # Barrel export
├── components/                  # Reusable UI components
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   ├── Button.module.css
│   │   └── index.ts
│   ├── Input/
│   ├── Card/
│   ├── Badge/
│   ├── Avatar/
│   ├── Modal/
│   ├── Toast/
│   ├── EmptyState/
│   ├── TaskItem/
│   ├── ProjectCard/
│   ├── UrgencyIndicator/
│   ├── QuickCapture/
│   ├── PartnerBadge/
│   └── LoadingSpinner/
├── tokens/                      # Design tokens
│   ├── colors.ts                # Color palette
│   ├── typography.ts            # Font sizes, weights, line heights
│   ├── spacing.ts               # Spacing scale
│   ├── shadows.ts               # Elevation shadows
│   ├── radii.ts                 # Border radii
│   ├── animations.ts            # Animation durations & easings
│   └── index.ts
├── hooks/                       # Shared React hooks
│   ├── useMediaQuery.ts
│   ├── useDebounce.ts
│   └── useClickOutside.ts
└── utils/                       # UI utility functions
    ├── cn.ts                    # ClassName merge utility
    ├── format-date.ts           # Date formatting helpers
    └── urgency-color.ts         # Map urgency level to color token
```

## Design Philosophy

The blueprint says the app should feel *"calm, warm, and trustworthy — less like software, more like a reliable shared memory."*

### Color Palette
- **Primary**: Calm teal (#0D9488 family) — trustworthy, calming
- **Urgency/Overdue**: Warm coral (#F97066) — alerting but not alarming
- **Urgency/Soon**: Soft amber (#F59E0B) — attention without stress
- **Urgency/On Track**: Sage green (#22C55E) — reassuring
- **Surfaces**: Warm grays (#F5F3F0, #E8E5E0) — not cold or sterile
- **Text**: Warm dark (#1C1917) — softer than pure black

### Typography
- **Font**: Inter (primary), system fallback
- **Scale**: 12 / 14 / 16 / 18 / 20 / 24 / 30 / 36 / 48
- **Weights**: 400 (regular), 500 (medium), 600 (semibold), 700 (bold)
- **Line height**: 1.5 for body, 1.2 for headings

### Spacing
- **Scale**: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96
- Base unit: 4px

### Animation
- **Duration**: 150ms (micro), 250ms (standard), 400ms (emphasis)
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` (standard)
- **Reduced motion**: All animations respect `prefers-reduced-motion`

## Component Rules

1. **Cross-platform** — Components should work in both web and React Native contexts (use platform-agnostic patterns where possible)
2. **Accessible** — All components meet WCAG 2.1 AA
3. **Themeable** — Use design tokens, not hardcoded values
4. **Tested** — Every component has co-located tests
5. **Documented** — Props documented via TypeScript interfaces
6. **Composable** — Components are building blocks, not monolithic widgets

## Build

```bash
pnpm build --filter=@lifesync/ui
```

This must run after `@lifesync/shared-types` and before app packages.
