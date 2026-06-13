import { describe, expect, it } from 'vitest';
import { groupByCategory, HOUSEHOLD_STATUS_META, SHOPPING_STATUSES } from './category-meta';

type Row = { category: string; sortOrder: number; name: string };

describe('category-meta', () => {
  it('maps the four statuses to badge tones', () => {
    expect(HOUSEHOLD_STATUS_META.stocked.tone).toBe('completed');
    expect(HOUSEHOLD_STATUS_META.low.tone).toBe('soon');
    expect(HOUSEHOLD_STATUS_META.out.tone).toBe('overdue');
    expect(HOUSEHOLD_STATUS_META.on_list.tone).toBe('primary');
  });

  it('lists shopping statuses', () => {
    expect(SHOPPING_STATUSES).toEqual(['out', 'low', 'on_list']);
  });

  it('groups items by curated category order, case-insensitively, sorted by sortOrder', () => {
    const items: Row[] = [
      { category: 'Dairy', sortOrder: 1, name: 'Milk' },
      { category: 'produce', sortOrder: 2, name: 'Spinach' },
      { category: 'produce', sortOrder: 1, name: 'Bananas' },
    ];
    const groups = groupByCategory(items);
    expect(groups.map((g) => g.category)).toEqual(['Produce', 'Dairy']);
    expect(groups[0].items.map((i) => i.name)).toEqual(['Bananas', 'Spinach']);
  });

  it('places unknown categories after the curated ones under their own heading', () => {
    const items: Row[] = [
      { category: 'Garage', sortOrder: 0, name: 'Motor oil' },
      { category: 'Pantry', sortOrder: 0, name: 'Rice' },
    ];
    const groups = groupByCategory(items);
    expect(groups.map((g) => g.category)).toEqual(['Pantry', 'Garage']);
  });
});
