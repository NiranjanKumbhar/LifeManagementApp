'use client';

import { useMemo, useState } from 'react';
import type { CalendarItem } from '@lifesync/shared-types';
import { Button, EmptyState, LoadingSpinner, PageShell } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { CalendarGrid } from '@/components/calendar/CalendarGrid';
import { DayAgenda } from '@/components/calendar/DayAgenda';
import { ReminderQuickAdd } from '@/components/calendar/ReminderQuickAdd';
import { monthGridDays, isoDay, shiftMonth } from '@/lib/calendar/grid';
import styles from './calendar.module.css';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarPage() {
  const workspaceId = useWorkspaceId();
  const enabled = Boolean(workspaceId);
  const todayIso = isoDay(new Date());

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selectedDay, setSelectedDay] = useState(todayIso);
  const [addingReminder, setAddingReminder] = useState(false);

  const grid = useMemo(() => monthGridDays(month.year, month.month), [month]);
  // monthGridDays always returns 42 days, so the endpoints are defined.
  const from = grid[0]!;
  const to = grid[grid.length - 1]!;

  const query = trpc.calendar.list.useQuery(
    { workspaceId: workspaceId ?? '', from, to },
    { enabled },
  );

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of query.data ?? []) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [query.data]);

  const goToday = () => {
    const now = new Date();
    setMonth({ year: now.getFullYear(), month: now.getMonth() + 1 });
    setSelectedDay(isoDay(now));
  };

  // Navigate months; select the 1st of the new month so the agenda always
  // reflects a day that's actually in view (the Today button re-selects today).
  const navMonth = (delta: number) => {
    const next = shiftMonth(month.year, month.month, delta);
    setMonth(next);
    setSelectedDay(`${next.year}-${String(next.month).padStart(2, '0')}-01`);
  };

  return (
    <PageShell>
      <header className={styles.head}>
        <div className={styles.nav}>
          <Button variant="ghost" size="sm" aria-label="Previous month" onClick={() => navMonth(-1)}>
            ‹
          </Button>
          <h1 className={styles.title}>
            {MONTHS[month.month - 1]} {month.year}
          </h1>
          <Button variant="ghost" size="sm" aria-label="Next month" onClick={() => navMonth(1)}>
            ›
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={goToday}>
          Today
        </Button>
      </header>

      {query.isLoading ? (
        <div className={styles.center}>
          <LoadingSpinner size="lg" label="Loading your calendar" />
        </div>
      ) : query.isError ? (
        <div className={styles.center}>
          <EmptyState title="We couldn't load your calendar" description="Make sure the API is running." />
        </div>
      ) : (
        <>
          <CalendarGrid
            month={month}
            itemsByDay={itemsByDay}
            selectedDay={selectedDay}
            today={todayIso}
            onSelectDay={setSelectedDay}
          />
          <DayAgenda
            day={selectedDay}
            items={itemsByDay.get(selectedDay) ?? []}
            onAddReminder={() => setAddingReminder(true)}
          />
        </>
      )}

      <ReminderQuickAdd isOpen={addingReminder} day={selectedDay} onClose={() => setAddingReminder(false)} />
    </PageShell>
  );
}
