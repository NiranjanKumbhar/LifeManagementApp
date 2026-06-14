export type CalendarItemKind =
  | 'project_due'
  | 'task_due'
  | 'birthday'
  | 'anniversary'
  | 'reminder';

export interface CalendarItem {
  /** Source row id (people items use `${personId}:birthday|anniversary`). */
  id: string;
  /** The day it lands on, YYYY-MM-DD. */
  date: string;
  kind: CalendarItemKind;
  title: string;
  /** Click-through target for project_due / task_due / reminder. */
  projectId: string | null;
  /** Click-through target for birthday / anniversary. */
  personId: string | null;
}
