import type { ProjectType } from '@lifesync/shared-types';

export type FieldKind = 'text' | 'number' | 'date' | 'boolean' | 'string-list';

export interface ProjectFieldDef {
  /** Key written into `customFields`. */
  key: string;
  label: string;
  kind: FieldKind;
}

/**
 * Maps each project type to its editable custom fields. Keys match the
 * `*Fields` interfaces in @lifesync/shared-types (snake_case).
 * `string-list` fields are entered as comma-separated values and stored as
 * `string[]`. `general` has no extra fields.
 */
export const PROJECT_FIELD_REGISTRY: Record<ProjectType, ProjectFieldDef[]> = {
  occasion: [
    { key: 'event_date', label: 'Event date', kind: 'date' },
    { key: 'gift_budget', label: 'Gift budget', kind: 'number' },
    { key: 'venue', label: 'Venue', kind: 'text' },
    { key: 'gift_ideas', label: 'Gift ideas', kind: 'string-list' },
    { key: 'recurring_annually', label: 'Recurs annually', kind: 'boolean' },
  ],
  compliance: [
    { key: 'document_type', label: 'Document type', kind: 'text' },
    { key: 'issuing_authority', label: 'Issuing authority', kind: 'text' },
    { key: 'reference_number', label: 'Reference number', kind: 'text' },
    { key: 'renewal_date', label: 'Renewal date', kind: 'date' },
    { key: 'lead_time_days', label: 'Lead time (days)', kind: 'number' },
  ],
  household: [
    { key: 'area', label: 'Area', kind: 'text' },
    { key: 'frequency', label: 'Frequency', kind: 'text' },
    { key: 'last_completed', label: 'Last completed', kind: 'date' },
    { key: 'supplies_needed', label: 'Supplies needed', kind: 'string-list' },
  ],
  health: [
    { key: 'provider', label: 'Provider', kind: 'text' },
    { key: 'appointment_type', label: 'Appointment type', kind: 'text' },
    { key: 'medication', label: 'Medication', kind: 'text' },
    { key: 'next_followup', label: 'Next follow-up', kind: 'date' },
  ],
  travel: [
    { key: 'destination', label: 'Destination', kind: 'text' },
    { key: 'departure_date', label: 'Departure date', kind: 'date' },
    { key: 'return_date', label: 'Return date', kind: 'date' },
    { key: 'visa_required', label: 'Visa required', kind: 'boolean' },
    { key: 'packing_list', label: 'Packing list', kind: 'string-list' },
  ],
  planning: [
    { key: 'budget', label: 'Budget', kind: 'number' },
    { key: 'decision_deadline', label: 'Decision deadline', kind: 'date' },
    { key: 'options_considered', label: 'Options considered', kind: 'string-list' },
  ],
  general: [],
};
