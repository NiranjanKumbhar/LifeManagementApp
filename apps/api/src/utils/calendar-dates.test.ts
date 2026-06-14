import { describe, expect, it } from 'vitest';
import { occurrenceInRange } from './calendar-dates';

describe('occurrenceInRange', () => {
  it('returns the occurrence date when the annual day lands in range', () => {
    expect(occurrenceInRange('1990-07-14', '2026-07-01', '2026-07-31')).toBe('2026-07-14');
  });
  it('returns null when the day is outside the range', () => {
    expect(occurrenceInRange('1990-03-02', '2026-07-01', '2026-07-31')).toBeNull();
  });
  it('handles a window that crosses a year boundary', () => {
    expect(occurrenceInRange('1988-01-02', '2026-12-28', '2027-01-07')).toBe('2027-01-02');
  });
  it('includes the range endpoints', () => {
    expect(occurrenceInRange('1990-07-31', '2026-07-01', '2026-07-31')).toBe('2026-07-31');
  });
});
