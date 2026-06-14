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
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className={styles.grid} role="grid" aria-label="Calendar">
      <div className={styles.weekrow} role="row">
        {WEEKDAYS.map((w) => (
          <span key={w} className={styles.weekday} role="columnheader">
            {w}
          </span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className={styles.week} role="row">
          {week.map((day) => {
            const [y, m, d] = day.split('-').map(Number);
            const inMonth = m === month.month && y === month.year;
            const items = itemsByDay.get(day) ?? [];
            const isToday = day === today;
            const isSelected = day === selectedDay;
            const label =
              `${d} ${MONTHS[m - 1]}` +
              (items.length ? `, ${items.length} item${items.length > 1 ? 's' : ''}` : '');
            return (
              <div key={day} role="gridcell" className={styles.cellWrap}>
                <button
                  type="button"
                  aria-pressed={isSelected}
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
                  <span className={styles.num} aria-hidden="true">
                    {d}
                  </span>
                  {items.length > 0 ? (
                    <span className={styles.dots} aria-hidden="true">
                      {items.slice(0, 3).map((it, i) => (
                        <span
                          key={i}
                          className={styles.dot}
                          style={{ background: CALENDAR_KIND_META[it.kind].tone }}
                        />
                      ))}
                      {items.length > 3 ? <span className={styles.more}>+{items.length - 3}</span> : null}
                    </span>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
