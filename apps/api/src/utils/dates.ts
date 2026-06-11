/**
 * Date utilities for lead-time and deadline math.
 * Dates stored as `date` columns are ISO strings (YYYY-MM-DD); timestamps are `Date`.
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Midnight (local) at the start of the given day. */
export function startOfDay(value: Date | string = new Date()): Date {
  const d = toDate(value);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Whole calendar days between two dates (b - a). Positive when b is later. */
export function differenceInDays(a: Date | string, b: Date | string): number {
  return Math.floor((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

/** Days from today until the given due date. Negative when overdue. Null when no date. */
export function daysUntil(dueDate: Date | string | null): number | null {
  if (!dueDate) return null;
  return differenceInDays(new Date(), dueDate);
}

export function addDays(value: Date | string, days: number): Date {
  const d = toDate(value);
  d.setDate(d.getDate() + days);
  return d;
}

/** Format a Date as a YYYY-MM-DD string (for `date` columns). */
export function toISODateString(value: Date | string): string {
  return startOfDay(value).toISOString().split('T')[0]!;
}

/**
 * Compute the next occurrence (this year or next) of a recurring month/day,
 * used for birthdays and anniversaries. Returns days from today.
 */
export function daysUntilAnnualDate(isoDate: string): number {
  const today = startOfDay();
  const src = startOfDay(isoDate);
  const next = new Date(today.getFullYear(), src.getMonth(), src.getDate());
  if (next.getTime() < today.getTime()) {
    next.setFullYear(today.getFullYear() + 1);
  }
  return differenceInDays(today, next);
}
