/**
 * Date formatting helpers. All accept `string | Date | null` because dates
 * cross the tRPC wire as ISO strings even where types say `Date`.
 */

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const MS_PER_DAY = 86_400_000;

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** e.g. "12 Jun" or "12 Jun 2027" if a different year. */
export function formatShortDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '';
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Human relative phrasing: "Today", "Tomorrow", "in 3 days", "5 days ago". */
export function formatRelativeDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '';
  const days = Math.round((startOfDay(d) - startOfDay(new Date())) / MS_PER_DAY);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days <= 7) return `in ${days} days`;
  if (days < -1 && days >= -7) return `${Math.abs(days)} days ago`;
  return formatShortDate(d);
}

/** Whole days until the date (negative = overdue), or null. */
export function daysUntil(value: string | Date | null | undefined): number | null {
  const d = toDate(value);
  if (!d) return null;
  return Math.round((startOfDay(d) - startOfDay(new Date())) / MS_PER_DAY);
}
