import type { UrgencyLevel } from '@lifesync/shared-types';

export interface UrgencyStyle {
  /** CSS variable for the solid accent color. */
  color: string;
  /** CSS variable for the soft background tint. */
  soft: string;
  label: string;
}

const MAP: Record<UrgencyLevel, UrgencyStyle> = {
  overdue: { color: 'var(--ls-urgency-overdue)', soft: 'var(--ls-urgency-overdue-soft)', label: 'Overdue' },
  critical: { color: 'var(--ls-urgency-overdue)', soft: 'var(--ls-urgency-overdue-soft)', label: 'Critical' },
  soon: { color: 'var(--ls-urgency-soon)', soft: 'var(--ls-urgency-soon-soft)', label: 'Soon' },
  on_track: { color: 'var(--ls-urgency-on-track)', soft: 'var(--ls-urgency-on-track-soft)', label: 'On track' },
  no_deadline: { color: 'var(--ls-text-tertiary)', soft: 'var(--ls-surface-sunken)', label: 'No deadline' },
};

export function urgencyStyle(level: UrgencyLevel): UrgencyStyle {
  return MAP[level];
}

/** Derive an urgency level from days-until-due (negative = overdue). */
export function urgencyFromDays(days: number | null): UrgencyLevel {
  if (days === null) return 'no_deadline';
  if (days < 0) return 'overdue';
  if (days <= 7) return 'critical';
  if (days <= 30) return 'soon';
  return 'on_track';
}
