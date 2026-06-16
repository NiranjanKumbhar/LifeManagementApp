import type { ProjectType } from '../enums/project-type';
import type { Visibility } from '../enums/visibility';
import type { Priority } from '../enums/priority';
import type { ProjectStatus } from '../enums/status';

// ── Recurrence ────────────────────────────────────────────────────────────────

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number;    // every N units; defaults to 1
  day?: string;         // e.g. 'monday', 'saturday' (for weekly)
  dayOfMonth?: number;  // 1-31 (for monthly)
  month?: number;       // 1-12 (for yearly)
  endDate?: string;     // ISO date string; open-ended if omitted
  count?: number;       // stop after N occurrences
}

// ── Type-specific custom fields ───────────────────────────────────────────────

export interface OccasionFields {
  event_date?: string;
  gift_budget?: number;
  gift_ideas?: string[];
  guests?: string[];
  venue?: string;
  recurring_annually?: boolean;
}

export interface ComplianceFields {
  document_type?: string;
  issuing_authority?: string;
  reference_number?: string;
  renewal_date?: string;
  documents_required?: string[];
  lead_time_days?: number;
}

export interface HouseholdProjectFields {
  area?: string;
  frequency?: string;
  last_completed?: string;
  supplies_needed?: string[];
}

export interface HealthFields {
  provider?: string;
  appointment_type?: string;
  medication?: string;
  dosage?: string;
  next_followup?: string;
}

export interface TravelFields {
  destination?: string;
  departure_date?: string;
  return_date?: string;
  booking_refs?: Record<string, string>;
  visa_required?: boolean;
  packing_list?: string[];
}

export interface PlanningFields {
  budget?: number;
  milestones?: Array<{ title: string; dueDate?: string; completed?: boolean }>;
  decision_deadline?: string;
  options_considered?: string[];
}

export type ProjectCustomFields =
  | OccasionFields
  | ComplianceFields
  | HouseholdProjectFields
  | HealthFields
  | TravelFields
  | PlanningFields
  | Record<string, unknown>;

// ── Entities ──────────────────────────────────────────────────────────────────

export interface ProjectTemplate {
  id: string;
  type: ProjectType;
  name: string;
  description: string | null;
  defaultTasks: Array<{ title: string; description?: string }>;
  defaultFields: Record<string, unknown>;
  isSystem: boolean;
  workspaceId: string | null;
  createdAt: Date;
}

export interface Project {
  id: string;
  workspaceId: string;
  type: ProjectType;
  title: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  ownerId: string | null;
  createdBy: string | null;
  completedBy: string | null;
  visibility: Visibility;
  dueDate: string | null;           // ISO date string (YYYY-MM-DD)
  earliestActionDate: string | null; // ISO date string
  leadTimeDays: number | null;
  customFields: ProjectCustomFields;
  templateId: string | null;
  isRecurring: boolean;
  recurrenceRule: RecurrenceRule | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
