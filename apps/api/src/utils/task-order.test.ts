import { describe, expect, it } from 'vitest';
import { compareTasks } from './task-order';

type Row = { sortOrder: number; createdAt: Date; id: string };

function sortIds(rows: Row[]): string[] {
  return [...rows].sort(compareTasks).map((r) => r.id);
}

describe('compareTasks', () => {
  it('orders by sortOrder first', () => {
    const rows: Row[] = [
      { sortOrder: 2, createdAt: new Date('2026-01-01'), id: 'b' },
      { sortOrder: 1, createdAt: new Date('2026-01-02'), id: 'a' },
    ];
    expect(sortIds(rows)).toEqual(['a', 'b']);
  });

  it('breaks sortOrder ties deterministically by createdAt (stable across input shuffles)', () => {
    // All tied at sortOrder 0 — the real-world case (tasks created without sortOrder).
    const a = { sortOrder: 0, createdAt: new Date('2026-01-01T00:00:00Z'), id: 'a' };
    const b = { sortOrder: 0, createdAt: new Date('2026-01-02T00:00:00Z'), id: 'b' };
    const c = { sortOrder: 0, createdAt: new Date('2026-01-03T00:00:00Z'), id: 'c' };
    // Whatever order the DB hands them back in, the result is the same.
    expect(sortIds([c, a, b])).toEqual(['a', 'b', 'c']);
    expect(sortIds([b, c, a])).toEqual(['a', 'b', 'c']);
    expect(sortIds([a, b, c])).toEqual(['a', 'b', 'c']);
  });

  it('falls back to id when sortOrder and createdAt are equal', () => {
    const t = new Date('2026-01-01T00:00:00Z');
    const rows: Row[] = [
      { sortOrder: 0, createdAt: t, id: 'y' },
      { sortOrder: 0, createdAt: t, id: 'x' },
    ];
    expect(sortIds(rows)).toEqual(['x', 'y']);
  });
});
