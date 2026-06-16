# New-User Onboarding Walkthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show new users a one-time modal-carousel walkthrough of the major features, remembered per account via `users.onboardedAt`.

**Architecture:** Add `users.onboardedAt` (migration `0006`, existing users backfilled) + a `user.completeOnboarding` mutation; an `OnboardingTour` modal carousel mounted in `AppShell` shows while `user.me.onboardedAt` is null and calls `completeOnboarding` on Skip/Finish.

**Tech Stack:** Drizzle + Postgres (pglite tests), tRPC v11, Next.js client components, `@lifesync/ui` `Modal`, Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-06-16-onboarding-walkthrough-design.md`

**IMPORTANT for all tasks:** Do NOT run `pnpm format` / Prettier — it rewrites line endings repo-wide on this Windows checkout. Only edit the files listed per task.

---

## File Structure
- `apps/api/src/db/migrations/0006_user_onboarded_at.sql` (create)
- `apps/api/src/db/schema/users.ts` (add column)
- `packages/shared-types/src/entities/user.ts` (add field)
- `apps/api/src/services/user.service.ts` + `apps/api/src/routers/user.ts` (+ `user.test.ts`)
- `apps/web/src/components/onboarding/OnboardingTour.tsx` (+ `.module.css`, + test)
- `apps/web/src/components/app-shell/AppShell.tsx` (mount + gate)

---

## Task 1: `users.onboardedAt` column + type

**Files:** `apps/api/src/db/migrations/0006_user_onboarded_at.sql`, `apps/api/src/db/schema/users.ts`, `packages/shared-types/src/entities/user.ts`

- [ ] **Step 1: Migration**

Create `apps/api/src/db/migrations/0006_user_onboarded_at.sql`:
```sql
ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamptz;
-- Existing users have already used the app; don't show them the new-user tour.
UPDATE "users" SET "onboarded_at" = now() WHERE "onboarded_at" IS NULL;
```

- [ ] **Step 2: Drizzle schema**

In `apps/api/src/db/schema/users.ts`, add to the `users` columns (after `avatarUrl` or before `createdAt`):
```ts
  onboardedAt: timestamp('onboarded_at', { withTimezone: true }),
```
(`timestamp` is already imported.)

- [ ] **Step 3: Shared type**

In `packages/shared-types/src/entities/user.ts`, add to the `User` interface (before `createdAt`):
```ts
  onboardedAt: Date | null;
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter=@lifesync/shared-types build && pnpm --filter=api test -- user`
Expected: shared-types builds; existing user tests pass (pglite builds the new column from the schema).

- [ ] **Step 5: Commit**
```bash
git add apps/api/src/db/migrations/0006_user_onboarded_at.sql apps/api/src/db/schema/users.ts packages/shared-types/src/entities/user.ts
git commit -m "feat(db): users.onboardedAt column (backfilled for existing users)"
```

---

## Task 2: `user.completeOnboarding` API

**Files:** `apps/api/src/services/user.service.ts`, `apps/api/src/routers/user.ts`, `apps/api/src/routers/user.test.ts`

- [ ] **Step 1: Write the failing test**

Read `apps/api/src/routers/user.test.ts` for the harness, then add:
```ts
describe('userRouter — completeOnboarding', () => {
  it('stamps onboardedAt on the current user', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    // seeded users are NOT pre-onboarded in tests (no migration backfill runs in pglite),
    // so onboardedAt starts null.
    const before = await alex.user.me();
    expect(before.onboardedAt).toBeNull();

    const after = await alex.user.completeOnboarding();
    expect(after.onboardedAt).not.toBeNull();

    const reloaded = await alex.user.me();
    expect(reloaded.onboardedAt).not.toBeNull();
  });
});
```
(If `user.test.ts` doesn't exist, create it following another router test's harness — `createTestDb`, `seedCouple`, `callerFor`. Check first.)

- [ ] **Step 2: Run (fails)**

Run: `pnpm --filter=api test -- user`
Expected: FAIL — `user.completeOnboarding` is not a function.

- [ ] **Step 3: Service method**

In `apps/api/src/services/user.service.ts`, add to `UserService`:
```ts
  static async completeOnboarding(db: Database, userId: string): Promise<Result<UserRow, AppError>> {
    const [row] = await db
      .update(users)
      .set({ onboardedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (!row) return { success: false, error: notFound('User not found') };
    return ok(row);
  }
```

- [ ] **Step 4: Router procedure**

In `apps/api/src/routers/user.ts`, add inside the router object:
```ts
  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    return unwrap(await UserService.completeOnboarding(ctx.db, ctx.userId));
  }),
```

- [ ] **Step 5: Run (passes)**

Run: `pnpm --filter=api test -- user && pnpm --filter=api typecheck`
Expected: PASS / clean.

- [ ] **Step 6: Commit**
```bash
git add apps/api/src/services/user.service.ts apps/api/src/routers/user.ts apps/api/src/routers/user.test.ts
git commit -m "feat(api): user.completeOnboarding mutation"
```

---

## Task 3: `OnboardingTour` modal carousel

**Files:** `apps/web/src/components/onboarding/OnboardingTour.tsx`, `OnboardingTour.module.css`, `OnboardingTour.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/onboarding/OnboardingTour.test.tsx`:
```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingTour } from './OnboardingTour';

describe('OnboardingTour', () => {
  it('steps forward and back through the tour', async () => {
    render(<OnboardingTour onDone={() => {}} />);
    expect(screen.getByText(/Welcome to LifeSync/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(/Quick Capture/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText(/Welcome to LifeSync/i)).toBeInTheDocument();
  });

  it('calls onDone from Skip and from the final step', async () => {
    const onDone = vi.fn();
    const { unmount } = render(<OnboardingTour onDone={onDone} />);
    await userEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
    unmount();

    const onDone2 = vi.fn();
    render(<OnboardingTour onDone={onDone2} />);
    // advance to the last step (6 steps → click Next 5 times)
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }));
    }
    await userEvent.click(screen.getByRole('button', { name: /get started/i }));
    expect(onDone2).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run (fails)**

Run: `pnpm --filter=web test -- OnboardingTour`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

First read `packages/ui/src/components/Modal/Modal.tsx` to confirm its props (it exposes `isOpen`, `onClose`, optional `title`, optional `footer`, `children`). Then create `apps/web/src/components/onboarding/OnboardingTour.tsx`:

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { Button, Modal } from '@lifesync/ui';
import {
  CalendarIcon,
  HomeIcon,
  HouseholdIcon,
  PlusIcon,
  ProjectsIcon,
  LockIcon,
} from '@/components/icons';
import styles from './OnboardingTour.module.css';

interface Step {
  icon: ReactNode;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  { icon: <HomeIcon />, title: 'Welcome to LifeSync', body: 'A calm, shared place for the two of you to stay on top of life together.' },
  { icon: <PlusIcon />, title: 'Quick Capture', body: 'The + button grabs anything fast — straight to your Inbox, the shopping list, or a project.' },
  { icon: <ProjectsIcon />, title: 'Projects', body: 'Structured plans with deadline awareness — occasions, travel, compliance, health and more.' },
  { icon: <HouseholdIcon />, title: 'Household', body: 'Your shared shopping list and home inventory, always in sync.' },
  { icon: <CalendarIcon />, title: 'Calendar & People', body: 'Due dates, birthdays and anniversaries, and gift ideas — all in one place.' },
  { icon: <LockIcon />, title: 'Shared or private', body: 'Invite your partner to collaborate, and keep any item to yourself with the lock.' },
];

export interface OnboardingTourProps {
  onDone: () => void;
}

export function OnboardingTour({ onDone }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  return (
    <Modal
      isOpen
      onClose={onDone}
      title={current.title}
      footer={
        <div className={styles.footer}>
          <Button variant="ghost" size="sm" onClick={onDone}>
            Skip
          </Button>
          <div className={styles.dots} aria-hidden="true">
            {STEPS.map((_, i) => (
              <span key={i} className={i === step ? styles.dotActive : styles.dot} />
            ))}
          </div>
          <div className={styles.nav}>
            {!isFirst ? (
              <Button variant="secondary" size="sm" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : null}
            {isLast ? (
              <Button size="sm" onClick={onDone}>
                Get started
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)}>
                Next
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className={styles.body}>
        <span className={styles.icon} aria-hidden="true">
          {current.icon}
        </span>
        <p className={styles.text}>{current.body}</p>
      </div>
    </Modal>
  );
}
```

(If `Modal`'s prop names differ from `isOpen`/`onClose`/`title`/`footer`, adjust — confirm from its source. `LockIcon` was added to `icons.tsx` in the visibility slice; confirm it's exported, else use another icon.)

Create `apps/web/src/components/onboarding/OnboardingTour.module.css`:
```css
.body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--ls-space-3);
  padding: var(--ls-space-3) 0;
}
.icon {
  display: inline-flex;
  color: var(--ls-primary-600);
}
.text {
  color: var(--ls-text-secondary);
  margin: 0;
  max-width: 28rem;
}
.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ls-space-3);
  width: 100%;
}
.nav {
  display: inline-flex;
  gap: var(--ls-space-2);
}
.dots {
  display: inline-flex;
  gap: var(--ls-space-1);
}
.dot,
.dotActive {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--ls-radius-full);
  background: var(--ls-surface-border);
}
.dotActive {
  background: var(--ls-primary-600);
}
```

- [ ] **Step 4: Run (passes) + typecheck**

Run: `pnpm --filter=web test -- OnboardingTour && pnpm --filter=web typecheck`
Expected: PASS / clean.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/components/onboarding/
git commit -m "feat(web): OnboardingTour modal carousel"
```

---

## Task 4: Mount in AppShell + verification

**Files:** `apps/web/src/components/app-shell/AppShell.tsx`, then full verification.

- [ ] **Step 1: Wire the tour into the shell**

Replace `apps/web/src/components/app-shell/AppShell.tsx` with (adds the `user.me` gate + `completeOnboarding`):

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { PlusIcon } from '../icons';
import { trpc } from '@/lib/trpc';
import { NavigationSidebar } from './NavigationSidebar';
import { BottomNav } from './BottomNav';
import { QuickCapture } from './QuickCapture';
import { OnboardingTour } from '../onboarding/OnboardingTour';
import styles from './AppShell.module.css';

export function AppShell({ children }: { children: ReactNode }) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [tourDismissed, setTourDismissed] = useState(false);
  const utils = trpc.useUtils();
  const me = trpc.user.me.useQuery();
  const completeOnboarding = trpc.user.completeOnboarding.useMutation({
    onSuccess: () => void utils.user.me.invalidate(),
  });

  const showTour = !tourDismissed && Boolean(me.data) && me.data?.onboardedAt == null;
  const finishTour = () => {
    setTourDismissed(true);
    completeOnboarding.mutate();
  };

  return (
    <div className={styles.shell}>
      <NavigationSidebar />

      <div className={styles.main}>
        <div className={styles.content}>{children}</div>
      </div>

      <button
        type="button"
        className={styles.fab}
        onClick={() => setCaptureOpen(true)}
        aria-label="Quick capture"
      >
        <PlusIcon size={24} />
      </button>

      <BottomNav onQuickCapture={() => setCaptureOpen(true)} />

      <QuickCapture open={captureOpen} onClose={() => setCaptureOpen(false)} />

      {showTour ? <OnboardingTour onDone={finishTour} /> : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + targeted tests**

Run: `pnpm --filter=web typecheck && pnpm --filter=web test -- OnboardingTour`
Expected: clean / PASS. If an existing `AppShell` test exists and now needs `user.me`/`completeOnboarding` mocked, update its `@/lib/trpc` mock (read it first; most app tests mock trpc per-component, and AppShell may have no test).

- [ ] **Step 3: Full verification**

Run, in order:
- `pnpm --filter=@lifesync/shared-types build && pnpm --filter=@lifesync/ui build` → success.
- `pnpm test` → all packages green.
- `pnpm typecheck` (all 5) and `pnpm --filter=web exec eslint "src" --quiet && pnpm --filter=api exec eslint "src" --quiet` → clean.

- [ ] **Step 4: Manual smoke (optional, local + DB migrated)**

Apply `0006` to the DB (hand-written like 0002–0005). A user with `onboardedAt = null` sees the tour on first load; Next/Back/dots work; Skip or Get started dismisses it and it doesn't return on reload.

- [ ] **Step 5: Commit**
```bash
git add apps/web/src/components/app-shell/AppShell.tsx
git commit -m "feat(web): show onboarding tour to new users in the app shell"
```

---

## Self-Review Notes
- **Spec coverage:** `users.onboardedAt` + backfill (T1) ✓; `completeOnboarding` API (T2) ✓; modal-carousel `OnboardingTour` with Next/Back/Skip/Get-started + dots, 6 steps (T3) ✓; shell gate on `me.onboardedAt == null` + invalidate (T4) ✓; first-run-only, no replay, no mobile ✓.
- **Type consistency:** `onboardedAt: Date | null` on the `User` entity matches the nullable Drizzle column and the `me`/`completeOnboarding` return; `OnboardingTourProps.onDone` is the single callback used by Skip + Get started; `showTour` uses `== null` to cover both null/undefined.
- **No-flash:** the shell renders the tour only once `me.data` is loaded AND `onboardedAt` is null; loading state renders nothing.
- **Migration `0006`** is hand-written (not in drizzle journal) → apply to live Supabase at deploy, like 0002–0005. pglite builds the column from the schema, so seeded test users start with `onboardedAt = null` (the backfill UPDATE doesn't run in pglite), which the Task 2 test relies on.
```
