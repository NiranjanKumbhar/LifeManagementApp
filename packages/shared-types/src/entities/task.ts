import type { TaskStatus } from '../enums/status';
import type { Priority } from '../enums/priority';
import type { RecurrenceRule } from './project';

export interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  ownerId: string | null;
  dueDate: string | null;   // ISO date string (YYYY-MM-DD)
  sortOrder: number;
  path: string;             // Materialized path: "ancestor-id.parent-id.task-id"
  dependsOnId: string | null;
  isRecurring: boolean;
  recurrenceRule: RecurrenceRule | null;
  completedAt: Date | null;
  completedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Recursive tree node for project.get responses
export interface TaskNode extends Task {
  children: TaskNode[];
}
