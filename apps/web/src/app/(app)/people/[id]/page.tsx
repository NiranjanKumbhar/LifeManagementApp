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
