import type { CalendarItemKind } from '@lifesync/shared-types';

export const CALENDAR_KIND_META: Record<CalendarItemKind, { label: string; icon: string; tone: string }> = {
  project_due: { label: 'Project due', icon: '📁', tone: 'var(--ls-primary-600)' },
  task_due: { label: 'Task due', icon: '✓', tone: 'var(--ls-primary-400)' },
  birthday: { label: 'Birthday', icon: '🎂', tone: 'var(--ls-urgency-soon)' },
  anniversary: { label: 'Anniversary', icon: '💗', tone: 'var(--ls-urgency-overdue)' },
  reminder: { label: 'Reminder', icon: '⏰', tone: 'var(--ls-text-tertiary)' },
};
