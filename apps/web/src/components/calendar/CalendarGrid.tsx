'use client';

import type { CalendarItem } from '@lifesync/shared-types';
import { cn } from '@lifesync/ui';
import { monthGridDays } from '@/lib/calendar/grid';
import { CALENDAR_KIND_META } from '@/lib/calendar/kind-meta';
import styles from './CalendarGrid.module.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface CalendarGridProps {
  month: { year: number; month: number };
  itemsByDay: Map<string, CalendarItem[]>;
  selectedDay: string;
  today: string;
  onSelectDay: (day: string) => void;
}

export function CalendarGrid({ month, itemsByDay, selectedDay, today, onSelectDay }: CalendarGridProps) {
  const days = monthGridDays(month.year, month.month);

  return (
    <div className={styles.grid} role="grid" aria-label="Calendar">
      <div className={styles.weekrow} role="row">
        {WEEKDAYS.map((w) => (
          <span key={w} className={styles.weekday} role="columnheader">
            {w}
          </span>
        ))}
      </div>
      <div className={styles.cells}>
        {days.map((day) => {
          const [y, m, d] = day.split('-').map(Number);
          const inMonth = m === month.month && y === month.year;
          const items = itemsByDay.get(day) ?? [];
          const isToday = day === today;
          const isSelected = day === selectedDay;
          const dayNum = d;
          const label =
            `${dayNum} ${MONTHS[m - 1]}` + (items.length ? `, ${items.length} item${items.length > 1 ? 's' : ''}` : '');
          return (
            <button
              key={day}
              type="button"
              aria-selected={isSelected}
              aria-current={isToday ? 'date' : undefined}
              aria-label={label}
              className={cn(
                styles.cell,
                !inMonth && styles.outside,
                isToday && styles.today,
                isSelected && styles.selected,
              )}
              onClick={() => onSelectDay(day)}
            >
              <span className={styles.num} aria-hidden="true" data-day={dayNum} />
              {items.length > 0 ? (
                <span className={styles.dots}>
                  {items.slice(0, 3).map((it, i) => (
                    <span
                      key={i}
                      className={styles.dot}
                      aria-hidden="true"
                      style={{ background: CALENDAR_KIND_META[it.kind].tone }}
                    />
                  ))}
                  <span className={styles.count}>{items.length}</span>
                  {items.length > 3 ? <span className={styles.more} aria-hidden="true">+{items.length - 3}</span> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
