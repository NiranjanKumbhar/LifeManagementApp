# Settings (Slice E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/settings` screen — Profile, Notifications, and Workspace sections that auto-save over the existing `user`/`workspace` routers.

**Architecture:** Pure frontend. A small extension to the shared `Input` (add `onBlur`, `disabled`, `type="time"`); a `useSaveStatus` hook + `timezones` util; a `SectionCard` wrapper; three section components; and the page. No backend / shared-types / DB changes.

**Tech Stack:** Next.js 15 client components + tRPC v11 + React Query + `@lifesync/ui`; Vitest + RTL + `@testing-library/user-event`.

**Spec:** `docs/superpowers/specs/2026-06-14-settings-slice-e-design.md`

**Key reference facts (verified against the codebase):**
- `user` router: `me` (returns the user row: `id, clerkId, email, displayName, avatarUrl, timezone, notificationPreferences, createdAt, updatedAt`), `updateProfile` (`{ displayName?, avatarUrl?, timezone? }`, field-level merge), `updateNotificationPrefs` (`{ preferences }`, **replaces** the whole `notificationPreferences`).
- `NotificationPreferences` = `{ quietHours?: { start; end }, digestMode?: 'none'|'daily'|'weekly', channels?: { push; email; inApp } }`.
- `workspace.get({ id })` → workspace row (has `name`); `workspace.members({ workspaceId })` → `MemberWithUser[]` = member row (`role`, …) + `user: { id, displayName, email, avatarUrl }`; `invite` is stubbed (`NOT_IMPLEMENTED`).
- `useWorkspaceId()` from `@/lib/hooks/useWorkspaceId` gives the workspace id (== `workspace.get`'s `id`).
- Clerk `UserButton` already in the sidebar handles avatar/email/password/sign-out — Settings doesn't reinvent those.
- `Input` (`@lifesync/ui`) currently supports `label, value, onChange, error?, helperText?, required?, placeholder?, id?`, `as="input|textarea|select"`, `type="text|number|date"`. It has **no** `onBlur`/`disabled`/`time` — Task 1 adds them.
- `Badge` tones: `neutral|primary|overdue|soon|completed`. `Avatar` takes `name`+`size`. Web test pattern: mock `@/lib/hooks/useWorkspaceId` + `@/lib/trpc`, wrap in `ToastProvider` (see `apps/web/src/app/(app)/people/[id]/page.test.tsx`). `inferRouterOutputs<AppRouter>` from `@trpc/server` / `api`.
- `/settings` sidebar link already exists; the route 404s. This slice removes the last dead sidebar route.

---

## File Structure

**Changed (UI):** `packages/ui/src/components/Input/Input.tsx` (+ its test) — add `onBlur`, `disabled`, `type="time"`.

**New (web):**
- `apps/web/src/lib/settings/{useSaveStatus.ts,useSaveStatus.test.ts,timezones.ts}`
- `apps/web/src/components/settings/{SectionCard,ProfileSettings,NotificationSettings,WorkspaceSettings}.tsx` (+ module css; section component tests)
- `apps/web/src/app/(app)/settings/{page.tsx,loading.tsx,settings.module.css,page.test.tsx}`

**No changes** to API / shared-types / DB.

---

## Task 1: Extend `Input` (onBlur, disabled, time)

**Files:**
- Modify: `packages/ui/src/components/Input/Input.tsx`
- Modify: `packages/ui/src/components/Input/Input.test.tsx`

- [ ] **Step 1: Add the failing test cases**

In `packages/ui/src/components/Input/Input.test.tsx`, add:

```tsx
it('fires onBlur when the field loses focus', async () => {
  const onBlur = vi.fn();
  render(<Input label="Name" value="Alex" onChange={() => {}} onBlur={onBlur} />);
  const field = screen.getByLabelText('Name');
  field.focus();
  field.blur();
  expect(onBlur).toHaveBeenCalled();
});

it('renders a disabled control', () => {
  render(<Input label="Email" value="a@b.com" onChange={() => {}} disabled />);
  expect(screen.getByLabelText('Email')).toBeDisabled();
});
```

(Ensure `vi` is imported in the test file — add it to the `vitest` import if missing.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @lifesync/ui test -- Input`
Expected: FAIL — `onBlur`/`disabled` not wired (onBlur never called; control not disabled).

- [ ] **Step 3: Extend the component**

In `packages/ui/src/components/Input/Input.tsx`:

Add to `BaseProps`:
```ts
  onBlur?: () => void;
  disabled?: boolean;
```
Widen the text type:
```ts
type TextProps = BaseProps & {
  as?: 'input';
  type?: 'text' | 'number' | 'date' | 'time';
};
```
Destructure the new props:
```ts
  const { label, value, onChange, error, helperText, required, placeholder, id, onBlur, disabled } = props;
```
Add to `shared`:
```ts
  const shared = {
    id: fieldId,
    value,
    required,
    placeholder,
    disabled,
    onBlur,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy,
    className: cn(styles.control, error && styles.invalid),
  } as const;
```
(`onBlur`/`disabled` now flow onto the `<input>`, `<textarea>`, and `<select>` via the `{...shared}` spread. The `() => void` shape is assignable to the DOM `onBlur` handler.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @lifesync/ui test -- Input`
Expected: PASS (existing tests + the 2 new).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Input/Input.tsx packages/ui/src/components/Input/Input.test.tsx
git commit -m "feat(ui): Input supports onBlur, disabled, and type=time"
```

---

## Task 2: Settings lib — `useSaveStatus`, `timezones`, `SectionCard`

**Files:**
- Create: `apps/web/src/lib/settings/useSaveStatus.ts` (+ `useSaveStatus.test.ts`)
- Create: `apps/web/src/lib/settings/timezones.ts`
- Create: `apps/web/src/components/settings/SectionCard.tsx` (+ `.module.css`)

- [ ] **Step 1: Write the failing hook test**

`apps/web/src/lib/settings/useSaveStatus.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSaveStatus } from './useSaveStatus';

describe('useSaveStatus', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('transitions idle → saving → saved → idle', () => {
    const { result } = renderHook(() => useSaveStatus());
    expect(result.current.status).toBe('idle');
    act(() => result.current.markSaving());
    expect(result.current.status).toBe('saving');
    act(() => result.current.markSaved());
    expect(result.current.status).toBe('saved');
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.status).toBe('idle');
  });

  it('markError sets error', () => {
    const { result } = renderHook(() => useSaveStatus());
    act(() => result.current.markError());
    expect(result.current.status).toBe('error');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- useSaveStatus`
Expected: FAIL — cannot resolve `./useSaveStatus`.

- [ ] **Step 3: Write the hook + util + SectionCard**

`apps/web/src/lib/settings/useSaveStatus.ts`:

```ts
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useSaveStatus(): {
  status: SaveStatus;
  markSaving: () => void;
  markSaved: () => void;
  markError: () => void;
} {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => clear, []);

  const markSaving = useCallback(() => {
    clear();
    setStatus('saving');
  }, []);
  const markSaved = useCallback(() => {
    clear();
    setStatus('saved');
    timer.current = setTimeout(() => setStatus('idle'), 2000);
  }, []);
  const markError = useCallback(() => {
    clear();
    setStatus('error');
  }, []);

  return { status, markSaving, markSaved, markError };
}
```

`apps/web/src/lib/settings/timezones.ts`:

```ts
const FALLBACK = [
  'UTC',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Kolkata',
  'Asia/Tokyo',
  'Australia/Sydney',
];

/** All IANA time zones, or a small curated fallback when unavailable. */
export function listTimeZones(): string[] {
  const intl = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  try {
    if (typeof intl.supportedValuesOf === 'function') {
      const zones = intl.supportedValuesOf('timeZone');
      if (zones.length > 0) return zones;
    }
  } catch {
    /* fall through */
  }
  return FALLBACK;
}
```

`apps/web/src/components/settings/SectionCard.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import type { SaveStatus } from '@/lib/settings/useSaveStatus';
import styles from './SectionCard.module.css';

export interface SectionCardProps {
  title: string;
  status?: SaveStatus;
  children: ReactNode;
}

export function SectionCard({ title, status, children }: SectionCardProps) {
  return (
    <section className={styles.card}>
      <header className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {status === 'saving' ? (
          <span className={styles.saving}>Saving…</span>
        ) : status === 'saved' ? (
          <span className={styles.saved}>Saved ✓</span>
        ) : null}
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
```

`apps/web/src/components/settings/SectionCard.module.css`:

```css
.card {
  background: var(--ls-surface-card);
  border: 1px solid var(--ls-surface-border);
  border-radius: var(--ls-radius-lg);
  padding: var(--ls-space-5);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--ls-space-4);
}

.title {
  margin: 0;
  font-size: var(--ls-text-lg);
  font-weight: 600;
  color: var(--ls-text-primary);
}

.saving {
  font-size: var(--ls-text-xs);
  color: var(--ls-text-tertiary);
}

.saved {
  font-size: var(--ls-text-xs);
  color: var(--ls-urgency-on-track);
  font-weight: 600;
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--ls-space-4);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- useSaveStatus`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/settings apps/web/src/components/settings/SectionCard.tsx apps/web/src/components/settings/SectionCard.module.css
git commit -m "feat(web): add settings save-status hook, timezones util, SectionCard"
```

---

## Task 3: `ProfileSettings`

**Files:**
- Create: `apps/web/src/components/settings/ProfileSettings.tsx`
- Test: `apps/web/src/components/settings/ProfileSettings.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/settings/ProfileSettings.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const profileMutate = vi.fn();
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ user: { me: { invalidate: vi.fn() } } }),
    user: { updateProfile: { useMutation: () => ({ mutate: profileMutate, isPending: false }) } },
  },
}));

import { ProfileSettings } from './ProfileSettings';

const me = {
  id: 'u1', displayName: 'Alex', email: 'alex@example.com', timezone: 'Europe/London',
  notificationPreferences: {},
};

function renderIt() {
  return render(
    <ToastProvider>
      <ProfileSettings me={me as never} />
    </ToastProvider>,
  );
}

describe('ProfileSettings', () => {
  it('saves the display name on blur', async () => {
    renderIt();
    const name = screen.getByLabelText('Display name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Alexandra');
    await userEvent.tab(); // blur
    expect(profileMutate).toHaveBeenCalledWith({ displayName: 'Alexandra' });
  });

  it('saves the timezone on change', async () => {
    renderIt();
    await userEvent.selectOptions(screen.getByLabelText('Timezone'), 'UTC');
    expect(profileMutate).toHaveBeenCalledWith({ timezone: 'UTC' });
  });

  it('shows the email as read-only', () => {
    renderIt();
    expect(screen.getByLabelText('Email')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- ProfileSettings`
Expected: FAIL — cannot resolve `./ProfileSettings`.

- [ ] **Step 3: Write the component**

`apps/web/src/components/settings/ProfileSettings.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { Input, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useSaveStatus } from '@/lib/settings/useSaveStatus';
import { listTimeZones } from '@/lib/settings/timezones';
import { SectionCard } from './SectionCard';

type Me = inferRouterOutputs<AppRouter>['user']['me'];

export function ProfileSettings({ me }: { me: Me }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const save = useSaveStatus();
  const [name, setName] = useState(me.displayName);

  const update = trpc.user.updateProfile.useMutation({
    onMutate: () => save.markSaving(),
    onSuccess: () => {
      void utils.user.me.invalidate();
      save.markSaved();
    },
    onError: (e: { message: string }) => {
      toast.error(e.message);
      void utils.user.me.invalidate();
      save.markError();
    },
  });

  const tzOptions = listTimeZones().map((z) => ({ value: z, label: z }));

  return (
    <SectionCard title="Profile" status={save.status}>
      <Input
        label="Display name"
        value={name}
        onChange={setName}
        onBlur={() => {
          const trimmed = name.trim();
          if (trimmed && trimmed !== me.displayName) update.mutate({ displayName: trimmed });
        }}
      />
      <Input
        as="select"
        label="Timezone"
        value={me.timezone}
        onChange={(tz) => update.mutate({ timezone: tz })}
        options={tzOptions}
      />
      <Input
        label="Email"
        value={me.email}
        onChange={() => {}}
        disabled
        helperText="Managed by your account."
      />
    </SectionCard>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- ProfileSettings`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/settings/ProfileSettings.tsx apps/web/src/components/settings/ProfileSettings.test.tsx
git commit -m "feat(web): add ProfileSettings (name, timezone, read-only email)"
```

---

## Task 4: `NotificationSettings`

**Files:**
- Create: `apps/web/src/components/settings/NotificationSettings.tsx` (+ `.module.css`)
- Test: `apps/web/src/components/settings/NotificationSettings.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/settings/NotificationSettings.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const prefsMutate = vi.fn();
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ user: { me: { invalidate: vi.fn() } } }),
    user: { updateNotificationPrefs: { useMutation: () => ({ mutate: prefsMutate, isPending: false }) } },
  },
}));

import { NotificationSettings } from './NotificationSettings';

const me = {
  id: 'u1', displayName: 'Alex', email: 'a@b.com', timezone: 'UTC',
  notificationPreferences: {
    channels: { push: true, email: true, inApp: true },
    digestMode: 'none',
    quietHours: { start: '22:00', end: '07:00' },
  },
};

function renderIt() {
  return render(
    <ToastProvider>
      <NotificationSettings me={me as never} />
    </ToastProvider>,
  );
}

describe('NotificationSettings', () => {
  it('toggling a channel saves the FULL preferences object', async () => {
    renderIt();
    await userEvent.click(screen.getByRole('checkbox', { name: /push/i }));
    expect(prefsMutate).toHaveBeenCalledWith({
      preferences: {
        channels: { push: false, email: true, inApp: true },
        digestMode: 'none',
        quietHours: { start: '22:00', end: '07:00' },
      },
    });
  });

  it('shows the not-delivered note', () => {
    renderIt();
    expect(screen.getByText(/aren.t delivered yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- NotificationSettings`
Expected: FAIL — cannot resolve `./NotificationSettings`.

- [ ] **Step 3: Write the component**

`apps/web/src/components/settings/NotificationSettings.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { Input, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useSaveStatus } from '@/lib/settings/useSaveStatus';
import { SectionCard } from './SectionCard';
import styles from './NotificationSettings.module.css';

type Me = inferRouterOutputs<AppRouter>['user']['me'];
type Channels = { push: boolean; email: boolean; inApp: boolean };
type DigestMode = 'none' | 'daily' | 'weekly';
type QuietHours = { start: string; end: string };

const CHANNELS: Array<{ key: keyof Channels; label: string }> = [
  { key: 'push', label: 'Push' },
  { key: 'email', label: 'Email' },
  { key: 'inApp', label: 'In-app' },
];
const DIGEST_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

export function NotificationSettings({ me }: { me: Me }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const save = useSaveStatus();

  const prefs = me.notificationPreferences ?? {};
  const [channels, setChannels] = useState<Channels>(prefs.channels ?? { push: true, email: true, inApp: true });
  const [digestMode, setDigestMode] = useState<DigestMode>((prefs.digestMode as DigestMode) ?? 'none');
  const [quietHours, setQuietHours] = useState<QuietHours>(prefs.quietHours ?? { start: '22:00', end: '07:00' });

  const update = trpc.user.updateNotificationPrefs.useMutation({
    onMutate: () => save.markSaving(),
    onSuccess: () => {
      void utils.user.me.invalidate();
      save.markSaved();
    },
    onError: (e: { message: string }) => {
      toast.error(e.message);
      void utils.user.me.invalidate();
      save.markError();
    },
  });

  // updateNotificationPrefs REPLACES the object, so always send the complete prefs.
  const persist = (over: { channels?: Channels; digestMode?: DigestMode; quietHours?: QuietHours }) => {
    update.mutate({
      preferences: {
        channels: over.channels ?? channels,
        digestMode: over.digestMode ?? digestMode,
        quietHours: over.quietHours ?? quietHours,
      },
    });
  };

  const toggleChannel = (key: keyof Channels) => {
    const next = { ...channels, [key]: !channels[key] };
    setChannels(next);
    persist({ channels: next });
  };

  return (
    <SectionCard title="Notifications" status={save.status}>
      <p className={styles.note}>
        Notifications aren&rsquo;t delivered yet — these preferences are saved for when delivery is enabled.
      </p>

      <fieldset className={styles.channels}>
        <legend className={styles.legend}>Channels</legend>
        {CHANNELS.map(({ key, label }) => (
          <label key={key} className={styles.channel}>
            <input type="checkbox" checked={channels[key]} onChange={() => toggleChannel(key)} />
            {label}
          </label>
        ))}
      </fieldset>

      <div className={styles.quiet}>
        <Input
          type="time"
          label="Quiet hours start"
          value={quietHours.start}
          onChange={(start) => {
            const next = { ...quietHours, start };
            setQuietHours(next);
            persist({ quietHours: next });
          }}
        />
        <Input
          type="time"
          label="Quiet hours end"
          value={quietHours.end}
          onChange={(end) => {
            const next = { ...quietHours, end };
            setQuietHours(next);
            persist({ quietHours: next });
          }}
        />
      </div>

      <Input
        as="select"
        label="Digest"
        value={digestMode}
        onChange={(v) => {
          const next = v as DigestMode;
          setDigestMode(next);
          persist({ digestMode: next });
        }}
        options={DIGEST_OPTIONS}
      />
    </SectionCard>
  );
}
```

`apps/web/src/components/settings/NotificationSettings.module.css`:

```css
.note {
  margin: 0;
  font-size: var(--ls-text-sm);
  color: var(--ls-text-secondary);
  background: var(--ls-surface-sunken);
  padding: var(--ls-space-3);
  border-radius: var(--ls-radius-md);
}

.channels {
  border: none;
  margin: 0;
  padding: 0;
  display: flex;
  gap: var(--ls-space-4);
  flex-wrap: wrap;
}

.legend {
  font-size: var(--ls-text-sm);
  font-weight: 600;
  color: var(--ls-text-secondary);
  padding: 0;
  margin-bottom: var(--ls-space-2);
}

.channel {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: var(--ls-text-sm);
  color: var(--ls-text-primary);
}

.quiet {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--ls-space-4);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- NotificationSettings`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/settings/NotificationSettings.tsx apps/web/src/components/settings/NotificationSettings.module.css apps/web/src/components/settings/NotificationSettings.test.tsx
git commit -m "feat(web): add NotificationSettings (channels, quiet hours, digest)"
```

---

## Task 5: `WorkspaceSettings`

**Files:**
- Create: `apps/web/src/components/settings/WorkspaceSettings.tsx` (+ `.module.css`)
- Test: `apps/web/src/components/settings/WorkspaceSettings.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/settings/WorkspaceSettings.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkspaceSettings } from './WorkspaceSettings';

const workspace = { id: 'ws-1', name: 'Our Home' };
const members = [
  { role: 'owner', user: { id: 'u1', displayName: 'Alex', email: 'a@b.com', avatarUrl: null } },
  { role: 'member', user: { id: 'u2', displayName: 'Jordan', email: 'j@b.com', avatarUrl: null } },
];

describe('WorkspaceSettings', () => {
  it('renders the workspace name and members', () => {
    render(
      <WorkspaceSettings workspace={workspace as never} members={members as never} currentUserId="u1" />,
    );
    expect(screen.getByText('Our Home')).toBeInTheDocument();
    expect(screen.getByText(/Alex/)).toBeInTheDocument();
    expect(screen.getByText('Jordan')).toBeInTheDocument();
  });

  it('disables the invite button', () => {
    render(
      <WorkspaceSettings workspace={workspace as never} members={members as never} currentUserId="u1" />,
    );
    expect(screen.getByRole('button', { name: /Invite/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- WorkspaceSettings`
Expected: FAIL — cannot resolve `./WorkspaceSettings`.

- [ ] **Step 3: Write the component**

`apps/web/src/components/settings/WorkspaceSettings.tsx`:

```tsx
'use client';

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { Avatar, Badge, Button } from '@lifesync/ui';
import { SectionCard } from './SectionCard';
import styles from './WorkspaceSettings.module.css';

type Workspace = inferRouterOutputs<AppRouter>['workspace']['get'];
type Member = inferRouterOutputs<AppRouter>['workspace']['members'][number];

export interface WorkspaceSettingsProps {
  workspace: Workspace | undefined;
  members: Member[];
  currentUserId: string;
}

export function WorkspaceSettings({ workspace, members, currentUserId }: WorkspaceSettingsProps) {
  return (
    <SectionCard title="Workspace">
      <div className={styles.name}>{workspace?.name ?? '—'}</div>

      <ul className={styles.members}>
        {members.map((m) => (
          <li key={m.user.id} className={styles.member}>
            <Avatar name={m.user.displayName} />
            <span className={styles.memberName}>
              {m.user.displayName}
              {m.user.id === currentUserId ? ' (you)' : ''}
            </span>
            <Badge tone={m.role === 'owner' ? 'primary' : 'neutral'}>
              {m.role === 'owner' ? 'Owner' : 'Member'}
            </Badge>
          </li>
        ))}
      </ul>

      <div className={styles.invite}>
        <Button variant="ghost" size="sm" disabled>
          Invite a partner
        </Button>
        <span className={styles.soon}>Coming soon</span>
      </div>
    </SectionCard>
  );
}
```

`apps/web/src/components/settings/WorkspaceSettings.module.css`:

```css
.name {
  font-size: var(--ls-text-base);
  font-weight: 600;
  color: var(--ls-text-primary);
}

.members {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ls-space-2);
}

.member {
  display: flex;
  align-items: center;
  gap: var(--ls-space-3);
}

.memberName {
  flex: 1 1 auto;
  color: var(--ls-text-primary);
}

.invite {
  display: flex;
  align-items: center;
  gap: var(--ls-space-3);
}

.soon {
  font-size: var(--ls-text-xs);
  color: var(--ls-text-tertiary);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- WorkspaceSettings`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/settings/WorkspaceSettings.tsx apps/web/src/components/settings/WorkspaceSettings.module.css apps/web/src/components/settings/WorkspaceSettings.test.tsx
git commit -m "feat(web): add WorkspaceSettings (name, members, disabled invite)"
```

---

## Task 6: `/settings` page

**Files:**
- Create: `apps/web/src/app/(app)/settings/page.tsx` (+ `loading.tsx`, `settings.module.css`)
- Test: `apps/web/src/app/(app)/settings/page.test.tsx`

- [ ] **Step 1: Write the failing test**

`apps/web/src/app/(app)/settings/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@lifesync/ui';

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ user: { me: { invalidate: vi.fn() } } }),
    user: {
      me: {
        useQuery: () => ({
          isLoading: false,
          isError: false,
          data: {
            id: 'u1', displayName: 'Alex', email: 'alex@example.com', timezone: 'UTC',
            notificationPreferences: { channels: { push: true, email: true, inApp: true }, digestMode: 'none', quietHours: { start: '22:00', end: '07:00' } },
          },
        }),
      },
      updateProfile: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      updateNotificationPrefs: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    workspace: {
      get: { useQuery: () => ({ data: { id: 'ws-1', name: 'Our Home' } }) },
      members: { useQuery: () => ({ data: [{ role: 'owner', user: { id: 'u1', displayName: 'Alex', email: 'a@b.com', avatarUrl: null } }] }) },
    },
  },
}));

import SettingsPage from './page';

function renderPage() {
  return render(
    <ToastProvider>
      <SettingsPage />
    </ToastProvider>,
  );
}

describe('SettingsPage', () => {
  it('renders the three settings sections', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Our Home')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- settings/page`
Expected: FAIL — cannot resolve `./page`.

- [ ] **Step 3: Write the page**

`apps/web/src/app/(app)/settings/page.tsx`:

```tsx
'use client';

import { EmptyState, LoadingSpinner } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { ProfileSettings } from '@/components/settings/ProfileSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { WorkspaceSettings } from '@/components/settings/WorkspaceSettings';
import styles from './settings.module.css';

export default function SettingsPage() {
  const workspaceId = useWorkspaceId();
  const enabled = Boolean(workspaceId);

  const meQuery = trpc.user.me.useQuery();
  const workspaceQuery = trpc.workspace.get.useQuery({ id: workspaceId ?? '' }, { enabled });
  const membersQuery = trpc.workspace.members.useQuery({ workspaceId: workspaceId ?? '' }, { enabled });

  if (meQuery.isLoading) {
    return (
      <div className={styles.center}>
        <LoadingSpinner size="lg" label="Loading settings" />
      </div>
    );
  }
  if (meQuery.isError || !meQuery.data) {
    return (
      <div className={styles.center}>
        <EmptyState title="We couldn't load your settings" description="Make sure the API is running." />
      </div>
    );
  }

  const me = meQuery.data;

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Settings</h1>
      <ProfileSettings me={me} />
      <NotificationSettings me={me} />
      <WorkspaceSettings
        workspace={workspaceQuery.data}
        members={membersQuery.data ?? []}
        currentUserId={me.id}
      />
    </div>
  );
}
```

`apps/web/src/app/(app)/settings/loading.tsx`:

```tsx
import { LoadingSpinner } from '@lifesync/ui';

export default function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
      <LoadingSpinner size="lg" label="Loading settings" />
    </div>
  );
}
```

`apps/web/src/app/(app)/settings/settings.module.css`:

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  max-width: 48rem;
  margin: 0 auto;
  width: 100%;
}

.heading {
  font-family: var(--ls-font-display);
  font-size: 1.6rem;
  margin: 0;
  color: var(--ls-text-primary);
}

.center {
  display: flex;
  justify-content: center;
  padding: 3rem 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- settings/page`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/settings"
git commit -m "feat(web): add /settings page (profile, notifications, workspace)"
```

---

## Task 7: Verification & docs

- [ ] **Step 1: Build deps, typecheck, web lint, full test suite**

Run:
```bash
pnpm --filter @lifesync/ui build
pnpm typecheck
pnpm --filter web lint
pnpm test
```
Expected: typecheck clean; web lint clean; all tests pass. New: ui Input (+2); web `useSaveStatus` (2) + `ProfileSettings` (3) + `NotificationSettings` (2) + `WorkspaceSettings` (2) + `settings/page` (1). (The pre-existing `@lifesync/ui` `Avatar.tsx` lint error exists on `main` — lint only `web`.)

- [ ] **Step 2: Manual smoke (recommended)**

`pnpm dev --filter=web` (+ `--filter=api`), open `/settings`:
- Change the display name and click away → "Saved ✓" flashes; reload persists it.
- Change timezone → saves immediately.
- Toggle a notification channel / quiet hours / digest → saves; the note explains delivery isn't active.
- Workspace shows the name + members; Invite is disabled ("Coming soon").
- Resize to mobile width → cards stack and stay usable.

- [ ] **Step 3: Update CLAUDE.md & the slice memory**

- `CLAUDE.md`: bump the test count; add the Settings screen to the Web "Done ✅" bullet; in "Remaining 🔭" item 1, mark **the whole "web screens" item complete** (all of Dashboard/Inbox/Projects/Household/People/Calendar/Settings now exist); remove the "`/settings` is a 404" known-stub line (now resolved); note Input gained `onBlur`/`disabled`/`time`.
- Update the `web-screens-slice-plan` memory: mark Slice E done — **all slices A–E complete**.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Settings (Slice E) complete — web screens roadmap item done"
```

---

## Self-Review Notes (verified against the spec)

- **§3.1 Profile (name on blur, timezone on change, read-only email)** → Task 3 (needs Task 1's `onBlur`/`disabled`).
- **§3.2 Notifications (channels/quiet-hours/digest; full-object replace; not-delivered note)** → Task 4 (`persist` always sends the complete prefs).
- **§3.3 Workspace (read-only name, members + role badge, disabled Invite)** → Task 5.
- **§4 auto-save mechanics (status indicator, invalidate + revert on error)** → Task 2 (`useSaveStatus`) + each section's mutation handlers.
- **§5 components + `useSaveStatus`/`timezones`** → Tasks 1, 2, 3–5.
- **§6 data flow (user.me, workspace.get/members), states** → Task 6.
- **§7 tests** → Tasks 1–6 (Input onBlur/disabled; hook transitions; name-blur; timezone-change; channel full-object; workspace members + disabled invite; page sections).
- **Type/name consistency:** `user.me`, `updateProfile({ displayName|timezone })`, `updateNotificationPrefs({ preferences: { channels, digestMode, quietHours } })`, `workspace.get({ id })`, `workspace.members({ workspaceId })`, `Member.user.{id,displayName}` + `Member.role`, `Badge tone`, `Avatar name`.
