import type { Project } from '../entities/project';
import type { Task } from '../entities/task';
import type { HouseholdItem } from '../entities/household';
import type { Person } from '../entities/person';

export interface DashboardData {
  /** Projects and tasks due today or with an action date of today */
  todayItems: (Project | Task)[];
  /** Projects and tasks due within the next 7 days */
  upcoming7Days: (Project | Task)[];
  /** Projects and tasks past their due date, not yet completed */
  overdue: (Project | Task)[];
  /** Shared items owned by the partner (for accountability visibility) */
  waitingOnPartner: (Project | Task)[];
  /** Household items with status 'low' or 'out' */
  lowStockItems: HouseholdItem[];
  /** People with birthdays or anniversaries in the next 30 days */
  upcomingDates: Person[];
  /** Projects and tasks completed in the last 7 days */
  recentlyCompleted: (Project | Task)[];
}
