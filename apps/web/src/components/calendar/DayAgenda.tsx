'use client';

import Link from 'next/link';
import type { CalendarItem } from '@lifesync/shared-types';
import { Button, formatShortDate } from '@lifesync/ui';
import { CALENDAR_KIND_META } from '@/lib/calendar/kind-meta';
import styles from './DayAgenda.module.css';

export interface DayAgendaProps {
  day: string;
  items: CalendarItem[];
  onAddReminder: () => void;
}

function hrefFor(item: CalendarItem): string | null {
  if (item.kind === 'birthday' || item.kind === 'anniversary') {
    return item.personId ? `/people/${item.personId}` : null;
  }
  return item.projectId ? `/projects/${item.projectId}` : null;
}

export function DayAgenda({ day, items, onAddReminder }: DayAgendaProps) {
  return (
    <section className={styles.agenda} aria-label="Day agenda">
      <header className={styles.head}>
        <h2 className={styles.date}>{formatShortDate(day)}</h2>
        <Button size="sm" variant="ghost" onClick={onAddReminder}>
          + Reminder
        </Button>
      </header>

      {items.length === 0 ? (
        <p className={styles.empty}>Nothing on this day.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((item) => {
            const meta = CALENDAR_KIND_META[item.kind];
            const href = hrefFor(item);
            const body = (
              <>
                <span className={styles.icon} aria-hidden="true">
                  {meta.icon}
                </span>
                <span className={styles.title}>{item.title}</span>
                <span className={styles.kind}>{meta.label}</span>
              </>
            );
            return (
              <li key={item.id} className={styles.row}>
                {href ? (
                  <Link href={href} className={styles.link}>
                    {body}
                  </Link>
                ) : (
                  <span className={styles.link}>{body}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
