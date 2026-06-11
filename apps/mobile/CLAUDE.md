# Mobile App — apps/mobile

## Overview

React Native + Expo SDK 52 mobile application. The mobile app is the primary daily-use interface for LifeSync — quick capture, grocery lists, and task management happen here.

## Directory Structure

```
src/
├── app/                        # Expo Router — file-based navigation
│   ├── _layout.tsx             # Root layout (providers, auth gate)
│   ├── (auth)/                 # Unauthenticated screens
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── (tabs)/                 # Bottom tab navigator
│   │   ├── _layout.tsx         # Tab bar + FAB configuration
│   │   ├── index.tsx           # Dashboard
│   │   ├── projects.tsx        # Projects list
│   │   ├── household.tsx       # Grocery/household
│   │   └── more/               # More tab sub-stack
│   │       ├── index.tsx
│   │       ├── calendar.tsx
│   │       ├── people.tsx
│   │       ├── inbox.tsx
│   │       └── settings.tsx
│   ├── projects/
│   │   └── [id].tsx            # Project detail
│   └── onboarding.tsx
├── components/                 # Mobile-specific components
├── lib/
│   ├── trpc.ts                 # tRPC client for mobile
│   ├── rxdb.ts                 # Local RxDB setup with SQLite
│   ├── sync.ts                 # PowerSync configuration
│   ├── notifications.ts        # Expo push notifications
│   └── haptics.ts              # Haptic feedback
└── hooks/
    ├── useLocalData.ts
    ├── useOfflineQueue.ts
    └── useQuickCapture.ts
```

## Key Conventions

- **Expo Router** for navigation — screens are files in `src/app/`, no manual navigator config needed
- **Reuse `@lifesync/ui` components** where platform-compatible
- **RxDB** for local-first data storage
- **Haptic feedback** on meaningful interactions (task complete, capture submit)
- **Gesture-first** — swipe to complete, swipe to snooze, pull to refresh
- **Offline-first** — all core features work without network

## Performance Targets

- App launch: < 2 seconds
- Quick capture focus: < 100ms
- List scroll: 60 FPS
- Local data read: < 50ms

## Development

```bash
pnpm dev --filter=mobile        # Start Expo dev server
npx expo start --ios            # iOS simulator
npx expo start --android        # Android emulator
```

## Testing

```bash
pnpm test --filter=mobile       # Unit + component tests
```
