import { describe, expect, it } from 'vitest';
import { calculateRiskScore, calculateUrgency, daysUntilDue } from './urgency';

// Fixed reference "now" keeps the day-math deterministic (no flakiness).
const NOW = new Date('2026-06-11T09:00:00Z');
const isoIn = (days: number): string => {
  const d = new Date(NOW.getTime() + days * 86_400_000);
  return d.toISOString().split('T')[0]!;
};

describe('daysUntilDue', () => {
  it('returns null when there is no due date', () => {
    expect(daysUntilDue(null, NOW)).toBeNull();
    expect(daysUntilDue(undefined, NOW)).toBeNull();
  });

  it('returns 0 for today, 1 for tomorrow, -1 for yesterday', () => {
    expect(daysUntilDue(isoIn(0), NOW)).toBe(0);
    expect(daysUntilDue(isoIn(1), NOW)).toBe(1);
    expect(daysUntilDue(isoIn(-1), NOW)).toBe(-1);
  });

  it('counts multi-day spans', () => {
    expect(daysUntilDue(isoIn(10), NOW)).toBe(10);
    expect(daysUntilDue(isoIn(-10), NOW)).toBe(-10);
  });
});

describe('calculateUrgency', () => {
  it('no_deadline when due date is null', () => {
    expect(calculateUrgency(null, NOW)).toBe('no_deadline');
  });

  it('overdue when the due date is in the past', () => {
    expect(calculateUrgency(isoIn(-1), NOW)).toBe('overdue');
    expect(calculateUrgency(isoIn(-30), NOW)).toBe('overdue');
  });

  it('critical when due today or within 7 days', () => {
    expect(calculateUrgency(isoIn(0), NOW)).toBe('critical');
    expect(calculateUrgency(isoIn(1), NOW)).toBe('critical');
    expect(calculateUrgency(isoIn(7), NOW)).toBe('critical');
  });

  it('soon when due within 8–30 days', () => {
    expect(calculateUrgency(isoIn(8), NOW)).toBe('soon');
    expect(calculateUrgency(isoIn(30), NOW)).toBe('soon');
  });

  it('on_track when due beyond 30 days', () => {
    expect(calculateUrgency(isoIn(31), NOW)).toBe('on_track');
    expect(calculateUrgency(isoIn(365), NOW)).toBe('on_track');
  });

  it('updates as the due date changes', () => {
    expect(calculateUrgency(isoIn(3), NOW)).toBe('critical');
    expect(calculateUrgency(isoIn(20), NOW)).toBe('soon');
    expect(calculateUrgency(isoIn(90), NOW)).toBe('on_track');
  });
});

describe('calculateRiskScore', () => {
  it('is 0 when there is no deadline', () => {
    expect(calculateRiskScore(null, 'high', NOW)).toBe(0);
  });

  it('is maxed out (100) for overdue items', () => {
    expect(calculateRiskScore(isoIn(-1), 'none', NOW)).toBe(100);
    expect(calculateRiskScore(isoIn(-30), 'urgent', NOW)).toBe(100);
  });

  it('increases as the deadline approaches', () => {
    const far = calculateRiskScore(isoIn(50), 'medium', NOW);
    const near = calculateRiskScore(isoIn(5), 'medium', NOW);
    expect(near).toBeGreaterThan(far);
  });

  it('adds a boost for higher priority at the same deadline', () => {
    const low = calculateRiskScore(isoIn(20), 'low', NOW);
    const urgent = calculateRiskScore(isoIn(20), 'urgent', NOW);
    expect(urgent).toBeGreaterThan(low);
  });

  it('never exceeds 100', () => {
    expect(calculateRiskScore(isoIn(0), 'urgent', NOW)).toBeLessThanOrEqual(100);
  });
});
