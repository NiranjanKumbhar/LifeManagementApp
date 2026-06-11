import type { ReminderType, ReminderSeverity } from '../enums/status';

export interface Reminder {
  id: string;
  projectId: string | null;
  taskId: string | null;
  userId: string;
  remindAt: Date;
  type: ReminderType;
  severity: ReminderSeverity;
  message: string | null;
  isSent: boolean;
  sentAt: Date | null;
  snoozedUntil: Date | null;
  createdAt: Date;
}
