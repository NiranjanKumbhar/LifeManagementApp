# Web App — apps/web

## Overview

Next.js 15 web application using the App Router. This is the primary web client for LifeSync.

## Directory Structure

```
src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root layout (providers, fonts, global styles)
│   ├── page.tsx                # Landing / redirect to dashboard
│   ├── (auth)/                 # Auth route group
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── (app)/                  # Authenticated app route group
│   │   ├── layout.tsx          # App shell (sidebar, bottom nav, quick capture)
│   │   ├── dashboard/
│   │   ├── inbox/
│   │   ├── projects/
│   │   │   ├── page.tsx        # Project list
│   │   │   └── [id]/
│   │   │       └── page.tsx    # Project detail
│   │   ├── household/
│   │   ├── calendar/
│   │   ├── people/
│   │   └── settings/
│   └── api/                    # API routes (if needed for webhooks)
├── components/                 # Web-specific components
├── lib/                        # Utilities and providers
│   ├── trpc.ts                 # tRPC client setup
│   ├── providers.tsx           # React context providers
│   ├── rxdb.ts                 # Local database setup
│   └── hooks/                  # Web-specific hooks
└── styles/
    ├── globals.css             # Global styles, CSS reset, font imports
    └── variables.css           # CSS custom properties from design tokens
```

## Key Conventions

- **App Router** — Use route groups `(auth)` and `(app)` for layout separation
- **Server Components** by default — Use `'use client'` only when needed
- **CSS Modules** for component styles — No global CSS classes for components
- **tRPC** for data fetching — Use React Query integration with suspense
- **`@/` alias** points to `src/` — e.g., `import { trpc } from '@/lib/trpc'`
- **Shared components from `@lifesync/ui`** — Don't rebuild what exists in the design system

## Performance

- Use `next/image` for all images
- Use `next/font` for font loading (Inter)
- Implement `loading.tsx` for route suspense boundaries
- Use React Server Components for data-fetching pages
- Implement `error.tsx` for error boundaries
- Cache tRPC queries with React Query

## Testing

```bash
pnpm test --filter=web          # Unit + component tests
pnpm test:e2e --filter=web      # Playwright E2E tests
```

## Development

```bash
pnpm dev --filter=web           # Starts on http://localhost:3000
```
