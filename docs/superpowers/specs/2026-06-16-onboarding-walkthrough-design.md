# New-User Onboarding Walkthrough — Design

> **Date:** 2026-06-16
> **Status:** Approved (design), pending implementation plan
> **Scope:** `apps/api` + `apps/web` + shared-types. No `apps/mobile` (RN) changes.

## Problem

A brand-new user lands in the app with no guidance. We want a first-run guided walkthrough
("Next"-style) introducing the major features, shown once per new account.

## Decisions (from brainstorming)

- **Modal carousel** style (Next / Back / Skip; "Get started" on the last step) — not spotlight
  coachmarks, not a dedicated route. Layout-independent and works on mobile.
- **Per-account persistence** via a new `users.onboardedAt` timestamp (correct "once per new user",
  works across devices).
- **First-run only** — no replay entry point in Settings.
- **Existing users are backfilled** to `onboardedAt = now()` so only genuinely new sign-ups see it.

## Design

### 1. Persistence — `users.onboardedAt`

- Migration `0006_user_onboarded_at.sql` (hand-written, like 0002–0005 — applies to live Supabase
  at deploy):
  ```sql
  ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamptz;
  -- Existing users have already used the app; don't show them the new-user tour.
  UPDATE "users" SET "onboarded_at" = now() WHERE "onboarded_at" IS NULL;
  ```
- Drizzle `schema/users.ts`: add `onboardedAt: timestamp('onboarded_at', { withTimezone: true })`
  (nullable).
- shared-types `entities/user.ts` `User`: add `onboardedAt: Date | null`. `user.me` returns the user
  row, so the field flows to the client automatically.

### 2. API — `completeOnboarding`

- `UserService.completeOnboarding(db, userId)` → `update users set onboarded_at = now()` for the
  user, returns the updated row (Result pattern).
- `user.completeOnboarding` tRPC mutation (`protectedProcedure`, no input) → unwraps the service.

### 3. Web — `OnboardingTour` (modal carousel)

- New `apps/web/src/components/onboarding/OnboardingTour.tsx` (+ `.module.css`, + test). Built on the
  shared `Modal` (overlay + focus trap). Props: `{ onDone: () => void }`.
- A `STEPS` array (icon node + title + body). Internal `step` state. Footer:
  - Step indicator dots.
  - **Back** (hidden on step 0), **Next** (steps before last), **Get started** (last step),
    and a **Skip** affordance.
  - **Skip** and **Get started** both call `onDone()`.
- Mounted in the app shell (`AppShell.tsx`): query `trpc.user.me`; when `me.data` is loaded and
  `me.data.onboardedAt === null`, render `<OnboardingTour onDone={...} />`. `onDone` calls the
  `completeOnboarding` mutation and on success invalidates `user.me` (so it won't reshow); the tour
  hides immediately (local `dismissed` state) to avoid flicker. While `me` is loading, render nothing
  (no flash).

### 4. Content — steps (~6)

1. **Welcome to LifeSync** — a calm, shared place for the two of you to stay on top of life.
2. **Quick Capture** — the **+** button grabs anything fast → your Inbox, shopping list, or a project.
3. **Projects** — structured plans with deadline awareness (occasions, travel, compliance, and more).
4. **Household** — your shared shopping list and inventory.
5. **Calendar & People** — due dates, birthdays/anniversaries, and gift ideas in one place.
6. **Shared or private** — invite your partner to collaborate; keep any item to yourself with the lock. → **Get started**.

Content lives in the `STEPS` array (icons reuse `apps/web/src/components/icons.tsx`).

### 5. Testing

- **API:** `completeOnboarding` sets `onboardedAt` (was null → not null); `me` reflects it.
- **Web:** `OnboardingTour` renders step 1's title; **Next** advances and **Back** returns; the step
  dots track position; **Skip** and **Get started** call `onDone`. App-shell behavior (shows the tour
  when `onboardedAt` is null, hides after completion) — covered by the component test via `onDone`
  plus a light shell test/mocked `user.me` if practical.

## Non-goals

- No spotlight/coachmark tour; no dedicated welcome route.
- No "replay tour" in Settings (first-run only).
- No mobile (RN) onboarding. No analytics on tour completion.

## Affected files (indicative)

- **DB:** `apps/api/src/db/migrations/0006_user_onboarded_at.sql` (new); `schema/users.ts` (column).
- **shared-types:** `entities/user.ts` (`onboardedAt`).
- **API:** `services/user.service.ts` (`completeOnboarding`), `routers/user.ts` (mutation).
- **Web:** `components/onboarding/OnboardingTour.tsx` (+ css + test); `components/app-shell/AppShell.tsx`
  (mount + `user.me` gate).
