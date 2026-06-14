import { describe, expect, it } from 'vitest';
import { monthGridDays, isoDay } from './grid';

describe('monthGridDays', () => {
  it('returns a 6-week (42-day) Monday-first grid covering the month', () => {
    const days = monthGridDays(2026, 6); // June 2026 (1-based month)
    expect(days).toHaveLength(42);
    expect(new Date(`${days[0]}T00:00:00`).getDay()).toBe(1); // Monday
    expect(days).toContain('2026-06-01');
    expect(days).toContain('2026-06-30');
    expect(days[41] > days[0]).toBe(true);
  });
});

describe('isoDay', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(isoDay(new Date(2026, 5, 9))).toBe('2026-06-09');
  });
});
