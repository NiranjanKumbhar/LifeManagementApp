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
  const sorted = useMemo(() => [...people].sort((a, b) => a.name.localeCompare(b.name)), [people]);
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
                    {person.relationship ? <span className={styles.rel}>{person.relationship}</span> : null}
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
