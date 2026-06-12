import type { ReactNode } from 'react';
import type { ProjectType } from '@lifesync/shared-types';
import {
  GiftIcon,
  ShieldIcon,
  HouseholdIcon,
  StethoscopeIcon,
  PlaneIcon,
  CompassIcon,
  ProjectsIcon,
} from '@/components/icons';

export interface ProjectTypeMeta {
  label: string;
  icon: ReactNode;
}

/** Display order for the grouped Projects list and the type select. */
export const PROJECT_TYPE_ORDER: ProjectType[] = [
  'occasion',
  'compliance',
  'household',
  'health',
  'travel',
  'planning',
  'general',
];

export const PROJECT_TYPE_META: Record<ProjectType, ProjectTypeMeta> = {
  occasion: { label: 'Occasions', icon: <GiftIcon /> },
  compliance: { label: 'Compliance', icon: <ShieldIcon /> },
  household: { label: 'Household', icon: <HouseholdIcon /> },
  health: { label: 'Health', icon: <StethoscopeIcon /> },
  travel: { label: 'Travel', icon: <PlaneIcon /> },
  planning: { label: 'Planning', icon: <CompassIcon /> },
  general: { label: 'General', icon: <ProjectsIcon /> },
};
