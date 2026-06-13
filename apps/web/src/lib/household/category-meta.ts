import type { StockStatus } from '@lifesync/shared-types';
import type { BadgeProps } from '@lifesync/ui';

/** Curated grocery categories, in display order. Stored as plain strings. */
export const HOUSEHOLD_CATEGORY_ORDER = [
  'Produce',
  'Dairy',
  'Meat & seafood',
  'Bakery',
  'Frozen',
  'Pantry',
  'Beverages',
  'Household supplies',
  'Personal care',
  'Other',
] as const;

export const HOUSEHOLD_STATUS_META: Record<StockStatus, { label: string; tone: BadgeProps['tone'] }> = {
  stocked: { label: 'Stocked', tone: 'completed' },
  low: { label: 'Low', tone: 'soon' },
  out: { label: 'Out', tone: 'overdue' },
  on_list: { label: 'On list', tone: 'primary' },
};

/** Statuses that appear on the Shopping list tab, in priority order. */
export const SHOPPING_STATUSES: StockStatus[] = ['out', 'low', 'on_list'];

export interface CategoryGroup<T> {
  category: string;
  items: T[];
}

/**
 * Group items into curated categories (case-insensitive match), with any
 * unknown categories appended after, each sorted by `sortOrder`.
 */
export function groupByCategory<T extends { category: string; sortOrder: number }>(
  items: T[],
): CategoryGroup<T>[] {
  const curatedLower = HOUSEHOLD_CATEGORY_ORDER.map((c) => c.toLowerCase());
  const buckets = new Map<string, T[]>();

  for (const item of items) {
    const idx = curatedLower.indexOf(item.category.toLowerCase());
    const key = idx >= 0 ? (HOUSEHOLD_CATEGORY_ORDER[idx] as string) : item.category;
    const arr = buckets.get(key) ?? [];
    arr.push(item);
    buckets.set(key, arr);
  }

  const ordered: string[] = [];
  for (const c of HOUSEHOLD_CATEGORY_ORDER) if (buckets.has(c)) ordered.push(c);
  for (const k of buckets.keys()) if (!ordered.includes(k)) ordered.push(k);

  return ordered.map((category) => ({
    category,
    items: [...(buckets.get(category) ?? [])].sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}
