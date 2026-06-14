/** A local Date as YYYY-MM-DD (no timezone shift). */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The 42 days (6 Monday-first weeks) of the grid that contains `month`
 * (1-based), as YYYY-MM-DD, including leading/trailing days of adjacent months.
 */
export function monthGridDays(year: number, month: number): string[] {
  const first = new Date(year, month - 1, 1);
  const mondayOffset = (first.getDay() + 6) % 7; // 0=Mon … 6=Sun
  const start = new Date(year, month - 1, 1 - mondayOffset);
  const days: string[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(isoDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  }
  return days;
}

/** Step a 1-based {year, month} by ±1 month. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
