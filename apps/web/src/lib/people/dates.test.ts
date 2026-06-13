import { describe, expect, it } from 'vitest';
import { nextKeyDate, nextOccurrence } from './dates';

const FROM = new Date(2026, 5, 13); // 13 Jun 2026 (local)

describe('nextOccurrence', () => {
  it('returns this year when the date is still upcoming', () => {
    expect(nextOccurrence('1990-07-14', FROM)).toEqual(new Date(2026, 6, 14));
  });
  it('rolls to next year when this year has passed', () => {
    expect(nextOccurrence('1985-03-02', FROM)).toEqual(new Date(2027, 2, 2));
  });
  it('treats today as upcoming (0 days)', () => {
    expect(nextOccurrence('2000-06-13', FROM)).toEqual(new Date(2026, 5, 13));
  });
});

describe('nextKeyDate', () => {
  it('returns null when no dates are set', () => {
    expect(nextKeyDate({ birthday: null, anniversary: null }, FROM)).toBeNull();
  });
  it('picks the sooner of birthday and anniversary', () => {
    const result = nextKeyDate({ birthday: '1990-08-01', anniversary: '2015-07-01' }, FROM);
    expect(result?.kind).toBe('anniversary');
    expect(result?.daysUntil).toBe(18);
  });
  it('reports a birthday with its day count', () => {
    const result = nextKeyDate({ birthday: '1990-06-25', anniversary: null }, FROM);
    expect(result?.kind).toBe('birthday');
    expect(result?.daysUntil).toBe(12);
  });
});
