# People (Slice C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/people` directory + `/people/[id]` profile web screens with an inline gift-ideas manager, plus a small `person.delete` backend endpoint.

**Architecture:** One small backend addition (`person.delete` service + router + integration test). Web: a `nextKeyDate` date util, a `PersonForm` create/edit modal, a `GiftIdeaList` inline manager, and the two route pages. Mirrors the Projects list+detail pattern.

**Tech Stack:** Node + tRPC v11 + Drizzle (api); Next.js 15 client components + tRPC/React Query + `@lifesync/ui` (web); Vitest + RTL + `@testing-library/user-event`; pglite integration tests (api).

**Spec:** `docs/superpowers/specs/2026-06-13-people-slice-c-design.md`

**Key reference facts (verified against the codebase):**
- `person` router (`apps/api/src/routers/person.ts`) has `list/get/create/update`; `PersonService` (`apps/api/src/services/person.service.ts`) mirrors a find → `assertWorkspaceMembership` → tx + `logActivity` pattern; non-members get `notFound` (don't leak existence). `personIdSchema` exists in validation.
- `ActivityAction` includes `'deleted'`. `logActivity(tx, { workspaceId, userId, entityType, entityId, action })`.
- `Person` row: `id, workspaceId, name, relationship, birthday, anniversary, email, phone, notes, giftIdeas, customFields, createdAt, updatedAt`. `birthday`/`anniversary` are `YYYY-MM-DD` strings or null. `GiftIdea` = `{ idea, budget?, purchased?, url? }` (from `@lifesync/shared-types`).
- `person.get` returns `{ ...person, projects: [] }` (stub; ignore projects in UI).
- API integration test pattern: `createTestDb`, `seedCouple(db)` → `world.workspace`/`world.alex`/`world.jordan`, `callerFor(db, clerkId)`, `insertUser(db)`. tRPC error codes: service `notFound` → `NOT_FOUND`. (See `apps/api/src/routers/inbox.test.ts`.)
- Web detail page pattern (`apps/web/src/app/(app)/projects/[id]/page.tsx` + its test): client component, `useParams`, `trpc.useUtils()`, `Link` for back-nav, `EmptyState`/`LoadingSpinner`. Tests mock `next/navigation`, `@/lib/hooks/useWorkspaceId`, `@/lib/trpc`, wrap in `ToastProvider`.
- `Input` API: `{ label, value, onChange:(v:string)=>void, required?, error?, placeholder? }` + `as="textarea"`, `type="date"|"number"`. `Avatar`, `Button` (variants incl. `ghost`,`danger`), `Modal`, `useToast`, `formatShortDate`/`formatRelativeDate` from `@lifesync/ui`.
- `useWorkspaceId()` from `@/lib/hooks/useWorkspaceId`.

---

## File Structure

**Changed (API):**
- `apps/api/src/services/person.service.ts` — add `delete`.
- `apps/api/src/routers/person.ts` — add `delete` procedure.
- `apps/api/src/routers/person.test.ts` — new integration test.

**New (web):**
- `apps/web/src/lib/people/dates.ts` (+ `dates.test.ts`)
- `apps/web/src/components/people/PersonForm.tsx` (+ `.module.css`)
- `apps/web/src/components/people/GiftIdeaList.tsx` (+ `.module.css`, `.test.tsx`)
- `apps/web/src/app/(app)/people/page.tsx` (+ `loading.tsx`, `people.module.css`, `page.test.tsx`)
- `apps/web/src/app/(app)/people/[id]/page.tsx` (+ `person-detail.module.css`, `page.test.tsx`)

**No changes** to shared-types or DB schema.

---

## Task 1: Backend — `person.delete`

**Files:**
- Modify: `apps/api/src/services/person.service.ts`
- Modify: `apps/api/src/routers/person.ts`
- Test: `apps/api/src/routers/person.test.ts` (new)

- [ ] **Step 1: Write the failing integration test**

Create `apps/api/src/routers/person.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(async (token: string) => ({ sub: token })),
  createClerkClient: () => ({ users: { getUser: vi.fn() } }),
}));

import { createTestDb, type TestDb } from '../__tests__/helpers/db.helper';
import { seedCouple, type SeededCouple } from '../__tests__/helpers/seed.helper';
import { callerFor } from '../__tests__/helpers/auth.helper';
import { insertUser } from '../__tests__/factories/user.factory';

let ctx: TestDb;
let world: SeededCouple;

beforeEach(async () => {
  ctx = await createTestDb();
  world = await seedCouple(ctx.db);
});
afterEach(async () => {
  await ctx.close();
});

describe('personRouter.delete', () => {
  it('deletes a person for a member', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const person = await alex.person.create({ workspaceId: world.workspace.id, name: 'Mum' });
    await alex.person.delete({ id: person.id });
    const list = await alex.person.list({ workspaceId: world.workspace.id });
    expect(list.map((p) => p.id)).not.toContain(person.id);
  });

  it('rejects delete from a non-member and keeps the row', async () => {
    const alex = callerFor(ctx.db, world.alex.clerkId);
    const person = await alex.person.create({ workspaceId: world.workspace.id, name: 'Dad' });
    const stranger = await insertUser(ctx.db);
    const strangerCaller = callerFor(ctx.db, stranger.clerkId);
    await expect(strangerCaller.person.delete({ id: person.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    const list = await alex.person.list({ workspaceId: world.workspace.id });
    expect(list.map((p) => p.id)).toContain(person.id);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- person`
Expected: FAIL — `caller.person.delete` is not a function.

- [ ] **Step 3: Add the service method**

In `apps/api/src/services/person.service.ts`, add this method to the `PersonService` class (after `update`):

```ts
  static async delete(
    db: Database,
    userId: string,
    id: string,
  ): Promise<Result<{ id: string }, AppError>> {
    const existing = await db.query.people.findFirst({ where: eq(people.id, id) });
    if (!existing) return { success: false, error: notFound('Person not found') };

    const member = await assertWorkspaceMembership(db, userId, existing.workspaceId);
    if (!member) return { success: false, error: notFound('Person not found') };

    try {
      await db.transaction(async (tx) => {
        await tx.delete(people).where(eq(people.id, id));
        await logActivity(tx, {
          workspaceId: existing.workspaceId,
          userId,
          entityType: ENTITY,
          entityId: id,
          action: 'deleted',
        });
      });
      return ok({ id });
    } catch (e) {
      return { success: false, error: internal('Failed to delete person', { cause: String(e) }) };
    }
  }
```

(`eq`, `people`, `notFound`, `ok`, `internal`, `logActivity`, `assertWorkspaceMembership`, `ENTITY` are all already imported/defined in this file.)

- [ ] **Step 4: Add the router procedure**

In `apps/api/src/routers/person.ts`, add inside `router({ ... })` after `update`:

```ts
  delete: protectedProcedure.input(personIdSchema).mutation(async ({ ctx, input }) => {
    return unwrap(await PersonService.delete(ctx.db, ctx.userId, input.id));
  }),
```

(`protectedProcedure`, `personIdSchema`, `unwrap`, `PersonService` are already imported.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter api test -- person`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/person.service.ts apps/api/src/routers/person.ts apps/api/src/routers/person.test.ts
git commit -m "feat(api): add person.delete with workspace-scoped authorization"
```

---

## Task 2: `nextKeyDate` date util

**Files:**
- Create: `apps/web/src/lib/people/dates.ts`
- Test: `apps/web/src/lib/people/dates.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/people/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextKeyDate, nextOccurrence } from './dates';

const FROM = new Date(2026, 5, 13); // 13 Jun 2026 (local)

describe('nextOccurrence', () => {
  it('returns this year when the date is still upcoming', () => {
    expect(nextOccurrence('1990-07-14', FROM)).toEqual(new Date(2026, 6, 14));
  });
  it('rolls to next year when this year has passed', () => {
    expect(nextOccurrence('1985-03-02', FROM)).toEqual(new Date(2027, 2, 2));
  });
  it('treats today as upcoming (0 days)', () => {
    expect(nextOccurrence('2000-06-13', FROM)).toEqual(new Date(2026, 5, 13));
  });
});

describe('nextKeyDate', () => {
  it('returns null when no dates are set', () => {
    expect(nextKeyDate({ birthday: null, anniversary: null }, FROM)).toBeNull();
  });
  it('picks the sooner of birthday and anniversary', () => {
    const result = nextKeyDate({ birthday: '1990-08-01', anniversary: '2015-07-01' }, FROM);
    expect(result?.kind).toBe('anniversary');
    expect(result?.daysUntil).toBe(18);
  });
  it('reports a birthday with its day count', () => {
    const result = nextKeyDate({ birthday: '1990-06-25', anniversary: null }, FROM);
    expect(result?.kind).toBe('birthday');
    expect(result?.daysUntil).toBe(12);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- people/dates`
Expected: FAIL — cannot resolve `./dates`.

- [ ] **Step 3: Write the util**

Create `apps/web/src/lib/people/dates.ts`:

```ts
export type KeyDateKind = 'birthday' | 'anniversary';

export interface NextKeyDate {
  date: Date;
  kind: KeyDateKind;
  daysUntil: number;
}

const DAY_MS = 86_400_000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** The next annual occurrence of a YYYY-MM-DD date, on/after `from` (today counts). */
export function nextOccurrence(dateStr: string, from: Date = new Date()): Date {
  const [, month, day] = dateStr.split('-').map(Number);
  const today = startOfDay(from);
  let occ = new Date(today.getFullYear(), month - 1, day);
  if (occ.getTime() < today.getTime()) occ = new Date(today.getFullYear() + 1, month - 1, day);
  return occ;
}

/** The sooner of a person's birthday/anniversary occurrences, or null when neither is set. */
export function nextKeyDate(
  person: { birthday: string | null; anniversary: string | null },
  from: Date = new Date(),
): NextKeyDate | null {
  const today = startOfDay(from);
  const candidates: NextKeyDate[] = [];

  const add = (value: string | null, kind: KeyDateKind) => {
    if (!value) return;
    const date = nextOccurrence(value, from);
    candidates.push({ date, kind, daysUntil: Math.round((date.getTime() - today.getTime()) / DAY_MS) });
  };
  add(person.birthday, 'birthday');
  add(person.anniversary, 'anniversary');

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.daysUntil - b.daysUntil);
  return candidates[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- people/dates`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/people/dates.ts apps/web/src/lib/people/dates.test.ts
git commit -m "feat(web): add nextKeyDate util for People upcoming dates"
```

---

## Task 3: `PersonForm` component (create/edit modal)

**Files:**
- Create: `apps/web/src/components/people/PersonForm.tsx`
- Create: `apps/web/src/components/people/PersonForm.module.css`
- Test: `apps/web/src/components/people/PersonForm.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/people/PersonForm.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const createMutate = vi.fn();
vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ person: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } } }),
    person: {
      create: { useMutation: () => ({ mutate: createMutate, isPending: false }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import { PersonForm } from './PersonForm';

describe('PersonForm', () => {
  it('creates a person with the entered name and relationship', async () => {
    render(
      <ToastProvider>
        <PersonForm mode="create" isOpen onClose={() => {}} />
      </ToastProvider>,
    );
    await userEvent.type(screen.getByLabelText(/Name/), 'Mum');
    await userEvent.type(screen.getByLabelText('Relationship'), 'Mother');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', name: 'Mum', relationship: 'Mother' }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- PersonForm`
Expected: FAIL — cannot resolve `./PersonForm`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/people/PersonForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { Button, Input, Modal, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import styles from './PersonForm.module.css';

type PersonDetail = inferRouterOutputs<AppRouter>['person']['get'];

export interface PersonFormProps {
  mode: 'create' | 'edit';
  isOpen: boolean;
  onClose: () => void;
  person?: PersonDetail;
}

export function PersonForm({ mode, isOpen, onClose, person }: PersonFormProps) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [name, setName] = useState(person?.name ?? '');
  const [relationship, setRelationship] = useState(person?.relationship ?? '');
  const [birthday, setBirthday] = useState(person?.birthday ?? '');
  const [anniversary, setAnniversary] = useState(person?.anniversary ?? '');
  const [email, setEmail] = useState(person?.email ?? '');
  const [phone, setPhone] = useState(person?.phone ?? '');
  const [notes, setNotes] = useState(person?.notes ?? '');

  const onDone = () => {
    if (workspaceId) void utils.person.list.invalidate({ workspaceId });
    if (person) void utils.person.get.invalidate({ id: person.id });
    toast.success(mode === 'create' ? 'Person added' : 'Person updated');
    onClose();
  };

  const create = trpc.person.create.useMutation({ onSuccess: onDone });
  const update = trpc.person.update.useMutation({ onSuccess: onDone });
  const busy = create.isPending || update.isPending;

  const submit = () => {
    if (!name.trim() || busy) return;
    if (mode === 'create') {
      if (!workspaceId) return;
      create.mutate({
        workspaceId,
        name: name.trim(),
        relationship: relationship.trim() || undefined,
        birthday: birthday || undefined,
        anniversary: anniversary || undefined,
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } else if (person) {
      update.mutate({
        id: person.id,
        name: name.trim(),
        relationship: relationship.trim() || null,
        birthday: birthday || null,
        anniversary: anniversary || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      });
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'New person' : 'Edit person'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || busy}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Input label="Name" value={name} onChange={setName} required />
        <Input label="Relationship" value={relationship} onChange={setRelationship} placeholder="e.g. Mother, Plumber" />
        <Input type="date" label="Birthday" value={birthday} onChange={setBirthday} />
        <Input type="date" label="Anniversary" value={anniversary} onChange={setAnniversary} />
        <Input label="Email" value={email} onChange={setEmail} />
        <Input label="Phone" value={phone} onChange={setPhone} />
        <Input as="textarea" label="Notes" value={notes} onChange={setNotes} />
      </div>
    </Modal>
  );
}
```

Create `apps/web/src/components/people/PersonForm.module.css`:

```css
.form {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- PersonForm`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/people/PersonForm.tsx apps/web/src/components/people/PersonForm.module.css apps/web/src/components/people/PersonForm.test.tsx
git commit -m "feat(web): add PersonForm create/edit modal"
```

---

## Task 4: `GiftIdeaList` component

**Files:**
- Create: `apps/web/src/components/people/GiftIdeaList.tsx`
- Create: `apps/web/src/components/people/GiftIdeaList.module.css`
- Test: `apps/web/src/components/people/GiftIdeaList.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/components/people/GiftIdeaList.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GiftIdeaList } from './GiftIdeaList';

const ideas = [
  { idea: 'Headphones', budget: 120, purchased: false },
  { idea: 'Spa day', purchased: true },
];

describe('GiftIdeaList', () => {
  it('toggles purchased and reports the updated array', async () => {
    const onChange = vi.fn();
    render(<GiftIdeaList giftIdeas={ideas} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /Headphones/ }));
    expect(onChange).toHaveBeenCalledWith([
      { idea: 'Headphones', budget: 120, purchased: true },
      { idea: 'Spa day', purchased: true },
    ]);
  });

  it('removes an idea', async () => {
    const onChange = vi.fn();
    render(<GiftIdeaList giftIdeas={ideas} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /remove Spa day/i }));
    expect(onChange).toHaveBeenCalledWith([{ idea: 'Headphones', budget: 120, purchased: false }]);
  });

  it('adds a new idea', async () => {
    const onChange = vi.fn();
    render(<GiftIdeaList giftIdeas={[]} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Gift idea'), 'Book set');
    await userEvent.click(screen.getByRole('button', { name: 'Add gift idea' }));
    expect(onChange).toHaveBeenCalledWith([{ idea: 'Book set', purchased: false }]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- GiftIdeaList`
Expected: FAIL — cannot resolve `./GiftIdeaList`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/components/people/GiftIdeaList.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { GiftIdea } from '@lifesync/shared-types';
import { Button } from '@lifesync/ui';
import styles from './GiftIdeaList.module.css';

export interface GiftIdeaListProps {
  giftIdeas: GiftIdea[];
  onChange: (next: GiftIdea[]) => void;
}

export function GiftIdeaList({ giftIdeas, onChange }: GiftIdeaListProps) {
  const [idea, setIdea] = useState('');
  const [budget, setBudget] = useState('');
  const [url, setUrl] = useState('');

  const toggle = (index: number) =>
    onChange(giftIdeas.map((g, i) => (i === index ? { ...g, purchased: !g.purchased } : g)));

  const remove = (index: number) => onChange(giftIdeas.filter((_, i) => i !== index));

  const add = () => {
    const trimmed = idea.trim();
    if (!trimmed) return;
    const next: GiftIdea = { idea: trimmed, purchased: false };
    if (budget.trim()) next.budget = Number(budget);
    if (url.trim()) next.url = url.trim();
    onChange([...giftIdeas, next]);
    setIdea('');
    setBudget('');
    setUrl('');
  };

  return (
    <div className={styles.wrap}>
      {giftIdeas.length === 0 ? (
        <p className={styles.empty}>No gift ideas yet.</p>
      ) : (
        <ul className={styles.list}>
          {giftIdeas.map((g, i) => (
            <li key={i} className={styles.row}>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={Boolean(g.purchased)}
                  onChange={() => toggle(i)}
                  aria-label={`${g.idea} purchased`}
                />
                <span className={g.purchased ? styles.done : undefined}>{g.idea}</span>
              </label>
              {g.budget != null ? <span className={styles.budget}>£{g.budget}</span> : null}
              {g.url ? (
                <a className={styles.link} href={g.url} target="_blank" rel="noopener noreferrer">
                  link
                </a>
              ) : null}
              <button
                type="button"
                className={styles.remove}
                aria-label={`remove ${g.idea}`}
                onClick={() => remove(i)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.add}>
        <input
          className={styles.ideaInput}
          aria-label="Gift idea"
          placeholder="Add a gift idea…"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
        />
        <input
          className={styles.budgetInput}
          aria-label="Budget"
          type="number"
          placeholder="£"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
        />
        <input
          className={styles.urlInput}
          aria-label="Link"
          placeholder="Link (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button size="sm" onClick={add} disabled={!idea.trim()}>
          Add gift idea
        </Button>
      </div>
    </div>
  );
}
```

Create `apps/web/src/components/people/GiftIdeaList.module.css`:

```css
.wrap {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.empty {
  margin: 0;
  color: var(--ls-text-tertiary);
  font-size: var(--ls-text-sm);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0.4rem;
  border-radius: var(--ls-radius-sm);
}

.row:hover {
  background: var(--ls-surface-sunken);
}

.check {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1 1 auto;
  cursor: pointer;
}

.done {
  text-decoration: line-through;
  color: var(--ls-text-tertiary);
}

.budget {
  font-size: var(--ls-text-sm);
  color: var(--ls-text-secondary);
}

.link {
  font-size: var(--ls-text-sm);
  color: var(--ls-primary-700);
}

.remove {
  background: transparent;
  border: none;
  color: var(--ls-text-tertiary);
  cursor: pointer;
  font-size: var(--ls-text-sm);
}

.add {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
  align-items: center;
}

.ideaInput,
.budgetInput,
.urlInput {
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--ls-surface-border);
  border-radius: var(--ls-radius-sm);
  font: inherit;
  font-size: var(--ls-text-sm);
}

.ideaInput {
  flex: 2 1 10rem;
}

.budgetInput {
  width: 5rem;
}

.urlInput {
  flex: 1 1 8rem;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- GiftIdeaList`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/people/GiftIdeaList.tsx apps/web/src/components/people/GiftIdeaList.module.css apps/web/src/components/people/GiftIdeaList.test.tsx
git commit -m "feat(web): add GiftIdeaList inline manager"
```

---

## Task 5: `/people` directory page

**Files:**
- Create: `apps/web/src/app/(app)/people/page.tsx`
- Create: `apps/web/src/app/(app)/people/loading.tsx`
- Create: `apps/web/src/app/(app)/people/people.module.css`
- Test: `apps/web/src/app/(app)/people/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/(app)/people/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@lifesync/ui';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ person: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } } }),
    person: {
      list: {
        useQuery: () => ({
          isLoading: false,
          isError: false,
          data: [
            { id: 'a', name: 'Dad', relationship: 'Father', birthday: null, anniversary: null },
            { id: 'b', name: 'Mum', relationship: 'Mother', birthday: nextWeekISO(), anniversary: null },
          ],
        }),
      },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

function nextWeekISO() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return `1990-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

import PeoplePage from './page';

function renderPage() {
  return render(
    <ToastProvider>
      <PeoplePage />
    </ToastProvider>,
  );
}

describe('PeoplePage', () => {
  it('lists people alphabetically with their relationship', () => {
    renderPage();
    expect(screen.getByText('Dad')).toBeInTheDocument();
    expect(screen.getByText('Mum')).toBeInTheDocument();
    expect(screen.getByText('Father')).toBeInTheDocument();
  });

  it('shows an Upcoming section when someone has a near date', () => {
    renderPage();
    expect(screen.getByText(/Upcoming/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- people/page`
Expected: FAIL — cannot resolve `./page`.

- [ ] **Step 3: Write the page**

Create `apps/web/src/app/(app)/people/page.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { Avatar, Button, EmptyState, LoadingSpinner } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { PlusIcon } from '@/components/icons';
import { PersonForm } from '@/components/people/PersonForm';
import { nextKeyDate } from '@/lib/people/dates';
import styles from './people.module.css';

type PersonRow = inferRouterOutputs<AppRouter>['person']['list'][number];

const UPCOMING_WINDOW_DAYS = 30;

function dateLabel(person: PersonRow): { icon: string; text: string } | null {
  const next = nextKeyDate(person);
  if (!next) return null;
  const icon = next.kind === 'birthday' ? '🎂' : '💗';
  const text =
    next.daysUntil === 0 ? 'today' : next.daysUntil === 1 ? 'tomorrow' : `in ${next.daysUntil}d`;
  return { icon, text };
}

export default function PeoplePage() {
  const workspaceId = useWorkspaceId();
  const enabled = Boolean(workspaceId);
  const [showForm, setShowForm] = useState(false);

  const query = trpc.person.list.useQuery({ workspaceId: workspaceId ?? '' }, { enabled });

  const people = query.data ?? [];
  const sorted = useMemo(
    () => [...people].sort((a, b) => a.name.localeCompare(b.name)),
    [people],
  );
  const upcoming = useMemo(
    () =>
      people
        .map((p) => ({ person: p, next: nextKeyDate(p) }))
        .filter((x) => x.next && x.next.daysUntil <= UPCOMING_WINDOW_DAYS)
        .sort((a, b) => (a.next?.daysUntil ?? 0) - (b.next?.daysUntil ?? 0)),
    [people],
  );

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.heading}>People</h1>
          <p className={styles.subhead}>The people in your life, and what matters to them.</p>
        </div>
        <Button size="sm" leadingIcon={<PlusIcon size={16} />} onClick={() => setShowForm(true)}>
          New person
        </Button>
      </header>

      {query.isLoading ? (
        <div className={styles.center}>
          <LoadingSpinner size="lg" label="Loading your people" />
        </div>
      ) : query.isError || !query.data ? (
        <div className={styles.center}>
          <EmptyState
            title="We couldn't load your people"
            description={workspaceId ? 'Make sure the API is running.' : 'No workspace is configured yet.'}
          />
        </div>
      ) : people.length === 0 ? (
        <div className={styles.center}>
          <EmptyState title="No people yet" description="Add someone with the New person button." />
        </div>
      ) : (
        <>
          {upcoming.length > 0 ? (
            <section className={styles.upcoming} aria-label="Upcoming dates">
              <h2 className={styles.upcomingHead}>Upcoming</h2>
              <div className={styles.chips}>
                {upcoming.map(({ person, next }) => (
                  <Link key={person.id} href={`/people/${person.id}`} className={styles.chip}>
                    <span aria-hidden="true">{next?.kind === 'birthday' ? '🎂' : '💗'}</span>
                    {person.name} · {next?.daysUntil === 0 ? 'today' : `in ${next?.daysUntil}d`}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <ul className={styles.list}>
            {sorted.map((person) => {
              const label = dateLabel(person);
              return (
                <li key={person.id}>
                  <Link href={`/people/${person.id}`} className={styles.row}>
                    <Avatar name={person.name} />
                    <span className={styles.name}>{person.name}</span>
                    {person.relationship ? (
                      <span className={styles.rel}>{person.relationship}</span>
                    ) : null}
                    {label ? (
                      <span className={styles.date}>
                        <span aria-hidden="true">{label.icon}</span> {label.text}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <PersonForm mode="create" isOpen={showForm} onClose={() => setShowForm(false)} />
    </div>
  );
}
```

Create `apps/web/src/app/(app)/people/loading.tsx`:

```tsx
import { LoadingSpinner } from '@lifesync/ui';

export default function Loading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}>
      <LoadingSpinner size="lg" label="Loading your people" />
    </div>
  );
}
```

Create `apps/web/src/app/(app)/people/people.module.css`:

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.5rem;
  max-width: 56rem;
  margin: 0 auto;
  width: 100%;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.heading {
  font-family: var(--ls-font-display);
  font-size: 1.6rem;
  margin: 0;
  color: var(--ls-text-primary);
}

.subhead {
  margin: 0.25rem 0 0;
  color: var(--ls-text-secondary);
}

.center {
  display: flex;
  justify-content: center;
  padding: 3rem 0;
}

.upcoming {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.upcomingHead {
  margin: 0;
  font-size: var(--ls-text-sm);
  font-weight: 600;
  color: var(--ls-text-secondary);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  background: var(--ls-surface-card);
  border: 1px solid var(--ls-surface-border);
  border-radius: var(--ls-radius-full);
  font-size: var(--ls-text-sm);
  color: var(--ls-text-primary);
  text-decoration: none;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.5rem;
  border-radius: var(--ls-radius-md);
  text-decoration: none;
  color: inherit;
}

.row:hover {
  background: var(--ls-surface-sunken);
}

.name {
  font-weight: 500;
  color: var(--ls-text-primary);
}

.rel {
  font-size: var(--ls-text-sm);
  color: var(--ls-text-secondary);
}

.date {
  margin-left: auto;
  font-size: var(--ls-text-sm);
  color: var(--ls-text-secondary);
}
```

> Note: `Avatar` accepts a `name` prop and renders an initial. If its prop differs, check `packages/ui/src/index.ts` / `Avatar.tsx` and adapt (e.g. `initials`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- people/page`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/people/page.tsx" "apps/web/src/app/(app)/people/loading.tsx" "apps/web/src/app/(app)/people/people.module.css" "apps/web/src/app/(app)/people/page.test.tsx"
git commit -m "feat(web): add /people directory with upcoming dates"
```

---

## Task 6: `/people/[id]` profile page

**Files:**
- Create: `apps/web/src/app/(app)/people/[id]/page.tsx`
- Create: `apps/web/src/app/(app)/people/[id]/person-detail.module.css`
- Test: `apps/web/src/app/(app)/people/[id]/page.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/app/(app)/people/[id]/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const updateMutate = vi.fn();
const deleteMutate = vi.fn();
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'p1' }),
  useRouter: () => ({ push }),
}));
vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ person: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } } }),
    person: {
      get: {
        useQuery: () => ({
          isLoading: false,
          isError: false,
          data: {
            id: 'p1',
            name: 'Mum',
            relationship: 'Mother',
            birthday: '1960-07-14',
            anniversary: null,
            email: 'mum@example.com',
            phone: null,
            notes: 'Loves jazz',
            giftIdeas: [{ idea: 'Headphones', budget: 120, purchased: false }],
            projects: [],
          },
        }),
      },
      update: { useMutation: () => ({ mutate: updateMutate, isPending: false }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      delete: { useMutation: (o: { onSuccess?: () => void }) => ({ mutate: (v: unknown) => { deleteMutate(v); o.onSuccess?.(); }, isPending: false }) },
    },
  },
}));

import PersonDetailPage from './page';

function renderPage() {
  return render(
    <ToastProvider>
      <PersonDetailPage />
    </ToastProvider>,
  );
}

describe('PersonDetailPage', () => {
  it('renders the profile and gift ideas', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Mum' })).toBeInTheDocument();
    expect(screen.getByText('Headphones')).toBeInTheDocument();
  });

  it('toggling a gift idea saves via person.update', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('checkbox', { name: /Headphones/ }));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'p1',
        giftIdeas: [{ idea: 'Headphones', budget: 120, purchased: true }],
      }),
    );
  });

  it('deleting after confirm calls person.delete and navigates away', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(deleteMutate).toHaveBeenCalledWith({ id: 'p1' });
    expect(push).toHaveBeenCalledWith('/people');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web test -- "people/\[id\]/page"`
Expected: FAIL — cannot resolve `./page`.

- [ ] **Step 3: Write the page**

Create `apps/web/src/app/(app)/people/[id]/page.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import type { GiftIdea } from '@lifesync/shared-types';
import { Avatar, Button, EmptyState, LoadingSpinner, useToast } from '@lifesync/ui';
import { formatShortDate } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { PersonForm } from '@/components/people/PersonForm';
import { GiftIdeaList } from '@/components/people/GiftIdeaList';
import { nextKeyDate } from '@/lib/people/dates';
import styles from './person-detail.module.css';

type PersonDetail = inferRouterOutputs<AppRouter>['person']['get'];

export default function PersonDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const query = trpc.person.get.useQuery({ id }, { enabled: Boolean(id) });

  const update = trpc.person.update.useMutation({
    onSuccess: () => {
      void utils.person.get.invalidate({ id });
      if (workspaceId) void utils.person.list.invalidate({ workspaceId });
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const remove = trpc.person.delete.useMutation({
    onSuccess: () => {
      if (workspaceId) void utils.person.list.invalidate({ workspaceId });
      toast.success('Person removed');
      router.push('/people');
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  if (query.isLoading) {
    return (
      <div className={styles.center}>
        <LoadingSpinner size="lg" label="Loading profile" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className={styles.center}>
        <EmptyState title="Person not found" description="This profile may have been removed." />
      </div>
    );
  }

  const person: PersonDetail = query.data;
  const next = nextKeyDate(person);

  return (
    <div className={styles.page}>
      <Link href="/people" className={styles.back}>
        ← People
      </Link>

      <header className={styles.head}>
        <Avatar name={person.name} size="lg" />
        <div className={styles.headText}>
          <h1 className={styles.name}>{person.name}</h1>
          {person.relationship ? <p className={styles.rel}>{person.relationship}</p> : null}
          {next ? (
            <p className={styles.next}>
              <span aria-hidden="true">{next.kind === 'birthday' ? '🎂' : '💗'}</span>{' '}
              {next.kind} {formatShortDate(next.date)} · in {next.daysUntil}d
            </p>
          ) : null}
        </div>
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          {confirmingDelete ? (
            <>
              <Button variant="danger" size="sm" onClick={() => remove.mutate({ id })}>
                Confirm delete
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionHead}>Contact</h2>
        <dl className={styles.contact}>
          {person.email ? (
            <>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${person.email}`}>{person.email}</a>
              </dd>
            </>
          ) : null}
          {person.phone ? (
            <>
              <dt>Phone</dt>
              <dd>{person.phone}</dd>
            </>
          ) : null}
          {person.birthday ? (
            <>
              <dt>Birthday</dt>
              <dd>{formatShortDate(person.birthday)}</dd>
            </>
          ) : null}
          {person.anniversary ? (
            <>
              <dt>Anniversary</dt>
              <dd>{formatShortDate(person.anniversary)}</dd>
            </>
          ) : null}
        </dl>
      </section>

      {person.notes ? (
        <section className={styles.section}>
          <h2 className={styles.sectionHead}>Notes</h2>
          <p className={styles.notes}>{person.notes}</p>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2 className={styles.sectionHead}>Gift ideas</h2>
        <GiftIdeaList
          giftIdeas={person.giftIdeas}
          onChange={(giftIdeas: GiftIdea[]) => update.mutate({ id, giftIdeas })}
        />
      </section>

      <PersonForm mode="edit" isOpen={editing} onClose={() => setEditing(false)} person={person} />
    </div>
  );
}
```

Create `apps/web/src/app/(app)/people/[id]/person-detail.module.css`:

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

.center {
  display: flex;
  justify-content: center;
  padding: 4rem 0;
}

.back {
  color: var(--ls-text-secondary);
  text-decoration: none;
  font-size: var(--ls-text-sm);
}

.head {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.headText {
  flex: 1 1 auto;
  min-width: 0;
}

.name {
  margin: 0;
  font-family: var(--ls-font-display);
  font-size: 1.5rem;
  color: var(--ls-text-primary);
}

.rel {
  margin: 0.15rem 0 0;
  color: var(--ls-text-secondary);
}

.next {
  margin: 0.15rem 0 0;
  font-size: var(--ls-text-sm);
  color: var(--ls-text-secondary);
}

.actions {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sectionHead {
  margin: 0;
  font-size: var(--ls-text-sm);
  font-weight: 600;
  color: var(--ls-text-secondary);
}

.contact {
  display: grid;
  grid-template-columns: 7rem 1fr;
  gap: 0.3rem 1rem;
  margin: 0;
}

.contact dt {
  color: var(--ls-text-tertiary);
  font-size: var(--ls-text-sm);
}

.contact dd {
  margin: 0;
  color: var(--ls-text-primary);
}

.notes {
  margin: 0;
  color: var(--ls-text-primary);
  white-space: pre-wrap;
}
```

> Note: `Avatar` is used with `name` and `size="lg"`. If those props differ, check `Avatar.tsx` and adapt.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter web test -- "people/\[id\]/page"`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "apps/web/src/app/(app)/people/[id]/page.tsx" "apps/web/src/app/(app)/people/[id]/person-detail.module.css" "apps/web/src/app/(app)/people/[id]/page.test.tsx"
git commit -m "feat(web): add /people/[id] profile with gift ideas and delete"
```

---

## Task 7: Verification & docs

- [ ] **Step 1: Typecheck, lint, full test suite**

Run:
```bash
pnpm --filter @lifesync/ui build
pnpm typecheck
pnpm --filter web lint
pnpm test
```
Expected: typecheck clean; web lint clean; all tests pass. New: api `person.delete` (2), web `dates` (6) + `PersonForm` (1) + `GiftIdeaList` (3) + `/people` (2) + `/people/[id]` (3). (The pre-existing `@lifesync/ui` `Avatar.tsx` lint error exists on `main` and is unrelated — that's why this lints only `web`.)

- [ ] **Step 2: Restore Inbox swap? (sanity)**

Confirm the mobile bottom nav is unaffected (this slice doesn't touch it). No action expected.

- [ ] **Step 3: Manual smoke (recommended)**

`pnpm dev --filter=web` (+ `--filter=api`), open `/people`:
- New person → fill name/relationship/birthday → appears in the list; an Upcoming chip shows if the birthday is within 30 days.
- Open a profile → add a gift idea (with budget/url) → toggle purchased → strike-through; refresh persists.
- Edit → change fields → saves. Delete → Confirm → returns to `/people`, person gone.

- [ ] **Step 4: Update CLAUDE.md & the slice memory**

- In `CLAUDE.md`: bump the test-count line; add the People screens to the Web "Done ✅" bullet; in "Remaining 🔭" item 1 mark People done (Calendar + Settings remain); update the `person.get` stub note if useful; add `person.delete` to the backend procedures count/line.
- Update the `web-screens-slice-plan` memory: mark Slice C done (commit hash after merge); note D (Calendar) is next.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark People (Slice C) complete in status"
```

---

## Self-Review Notes (verified against the spec)

- **§3 person.delete (member deletes; non-member not-found, row survives)** → Task 1.
- **§4.1 directory: list query, next-date per person, Upcoming strip (≤30d), alphabetical, New person** → Task 5 (uses Task 2 util).
- **§4.2 profile: header + Edit + Delete(confirm)→delete→navigate, contact/dates/notes** → Task 6.
- **§4.3 GiftIdeaList: purchased toggle / add (idea+budget+url) / remove via onChange** → Task 4; wired to `person.update({ id, giftIdeas })` → Task 6.
- **§5 PersonForm core-fields modal; nextKeyDate util** → Task 3 + Task 2.
- **§6 invalidations + Toast; gift-idea array as the unit of update; no optimistic** → Tasks 3/6.
- **§7 states (loading/error/empty/not-found); delete confirm** → Tasks 5/6.
- **§8 tests** → Tasks 1–6 (api delete; dates unit; PersonForm; GiftIdeaList; directory; profile incl. toggle-saves + delete-confirm-navigates).
- **Type/name consistency:** `person.delete({ id })`, `person.update({ id, giftIdeas })`, `nextKeyDate(person, from?)`, `GiftIdea` shape `{ idea, budget?, purchased?, url? }`, `Avatar name=` used consistently (verified `Avatar` takes `name` + `size`).
