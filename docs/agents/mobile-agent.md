# Mobile Agent — Full Instructions

## Role

You are the **Mobile Agent** responsible for building the LifeSync React Native mobile app using Expo. The mobile experience is where most daily interactions happen — quick capture while shopping, checking tasks during commute, marking items complete on the go.

## Key References

| Document | Path | Purpose |
|---|---|---|
| Product Blueprint | `life-management-app-blueprint.md` | Requirements, UX, features |
| Root Instructions | `CLAUDE.md` | Tech stack, conventions |
| Design System | `packages/ui/CLAUDE.md` | Shared components |
| API Contracts | `docs/architecture/api-contracts.md` | Backend endpoints |
| Sync Strategy | `docs/architecture/sync-strategy.md` | Offline-first requirements |

## Your Directory

```
apps/mobile/
├── app.config.ts                # Expo configuration
├── package.json
├── CLAUDE.md                    # Mobile-specific instructions
└── src/
    ├── app/                     # Expo Router — file-based navigation
    │   ├── _layout.tsx          # Root layout (providers, auth gate)
    │   ├── (auth)/              # Unauthenticated screens
    │   │   ├── _layout.tsx
    │   │   ├── sign-in.tsx
    │   │   └── sign-up.tsx
    │   ├── (tabs)/              # Bottom tab navigator
    │   │   ├── _layout.tsx      # Tab bar configuration + FAB
    │   │   ├── index.tsx        # Dashboard tab
    │   │   ├── projects.tsx     # Projects tab
    │   │   ├── household.tsx    # Household/grocery tab
    │   │   └── more/            # More tab (sub-stack)
    │   │       ├── _layout.tsx
    │   │       ├── index.tsx    # More menu
    │   │       ├── calendar.tsx
    │   │       ├── people.tsx
    │   │       ├── inbox.tsx
    │   │       └── settings.tsx
    │   ├── projects/
    │   │   └── [id].tsx         # Project detail screen
    │   └── onboarding.tsx       # First-run onboarding
    ├── components/              # Mobile-specific components
    │   ├── QuickCaptureSheet.tsx    # Bottom sheet quick add
    │   ├── SwipeableTaskItem.tsx    # Swipeable task with actions
    │   ├── UrgencyBanner.tsx        # Top banner for overdue items
    │   ├── PartnerActivityFeed.tsx  # Partner's recent actions
    │   └── GroceryCheckItem.tsx     # Tap-to-check grocery item
    ├── lib/
    │   ├── trpc.ts              # tRPC client for mobile
    │   ├── rxdb.ts              # Local RxDB database setup
    │   ├── sync.ts              # PowerSync configuration
    │   ├── notifications.ts     # Push notification handlers
    │   ├── haptics.ts           # Haptic feedback utilities
    │   └── storage.ts           # AsyncStorage helpers
    └── hooks/
        ├── useLocalData.ts      # Hook for RxDB reactive queries
        ├── useOfflineQueue.ts   # Queue mutations when offline
        └── useQuickCapture.ts   # Quick capture logic
```

## Mobile-Specific UX Requirements

### 1. Quick Capture — The #1 Priority
The blueprint says: *"Capture speed must be near-instant."*

- **Bottom sheet pattern**: FAB (floating action button) opens a bottom sheet, not a full screen
- **Auto-focus**: Input field focuses immediately when sheet opens (< 100ms)
- **Minimal fields**: Just text input + submit. Optional: project selector, date picker
- **Haptic feedback**: Light tap on submit, medium success on task creation
- **Keyboard-aware**: Sheet adjusts above keyboard automatically
- **Quick close**: Swipe down or tap backdrop to dismiss

### 2. Gesture-First Interactions
- **Swipe right** on a task → mark complete (with satisfying animation)
- **Swipe left** on a task → snooze / reschedule
- **Long press** → drag to reorder
- **Pull to refresh** → sync with server
- **Pinch to zoom** on calendar → switch between week/month views

### 3. Offline-First Architecture
The app must work fully offline for core operations:
- RxDB stores all workspace data locally
- All reads come from local database (instant)
- Writes go to local database first, then sync via PowerSync
- Visual indicator when offline (subtle, not alarming)
- Queue indicator showing pending sync count
- Automatic conflict resolution on reconnect

### 4. Notifications
- Integrate Expo Notifications for push
- Handle notification permissions gracefully
- Deep link from notification to relevant project/task
- Support notification actions (mark complete, snooze) from lock screen
- Respect user's notification preferences (quiet hours, digest mode)

### 5. Performance Targets
- App launch to interactive: < 2 seconds
- Quick capture sheet open: < 100ms
- List scroll: 60 FPS constant
- Screen transitions: smooth native animations
- Local data queries: < 50ms

## Design Adaptation for Mobile

### Navigation Structure

Navigation is **file-based via Expo Router** — the `src/app/` directory IS the navigation tree.

```
Bottom Tabs (src/app/(tabs)/_layout.tsx):
├── Dashboard    → src/app/(tabs)/index.tsx
├── Projects     → src/app/(tabs)/projects.tsx
├── + Quick Capture (FAB — opens QuickCaptureSheet, not a tab)
├── Household    → src/app/(tabs)/household.tsx
└── More         → src/app/(tabs)/more/_layout.tsx
    ├── Calendar → src/app/(tabs)/more/calendar.tsx
    ├── People   → src/app/(tabs)/more/people.tsx
    ├── Inbox    → src/app/(tabs)/more/inbox.tsx
    └── Settings → src/app/(tabs)/more/settings.tsx
```

Deep links and push notification routing use Expo Router's built-in linking — no manual `linking.ts` required.

### Mobile-Specific Design
- Cards should be wider, touch-friendly (minimum 44px tap targets)
- Use native sheet patterns (bottom sheets, not desktop modals)
- Urgency badges should be color-coded dots (not text labels on mobile)
- Use `SafeAreaView` for notched devices
- Support dark mode (follow system setting by default)
- Smooth animations using `react-native-reanimated`

## Local Database Schema (RxDB)

Mirror the PostgreSQL schema locally with RxDB collections:
```typescript
const collections = {
  projects: { /* mirror projects table */ },
  tasks: { /* mirror tasks table */ },
  reminders: { /* mirror reminders table */ },
  household_items: { /* mirror household_items table */ },
  people: { /* mirror people table */ },
  notifications: { /* local notification state */ },
};
```

PowerSync handles bidirectional sync between RxDB ↔ PostgreSQL.

## Platform-Specific Considerations

### iOS
- Use `UIImpactFeedbackGenerator` haptics via Expo Haptics
- Support Dynamic Type (system font scaling)
- Handle safe area insets for notch/Dynamic Island
- Widget support for dashboard summary (V2)

### Android
- Material Design 3 touch ripples
- Handle back button in navigation stack
- Support predictive back gesture (Android 14+)
- Handle different screen densities

## Testing
- Unit tests for hooks and utility functions
- Component tests for key screens
- Use `@testing-library/react-native`
- Test offline scenarios (mock network unavailability)
- Test on both iOS and Android simulators
