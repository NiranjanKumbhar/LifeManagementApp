import type { ReactNode } from 'react';
import type { SecondNavKey } from '@/lib/nav-prefs';
import {
  CalendarIcon,
  HomeIcon,
  HouseholdIcon,
  InboxIcon,
  PeopleIcon,
  ProjectsIcon,
  SettingsIcon,
} from '../icons';

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

/** Full navigation set — used by the desktop sidebar. */
export const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: <HomeIcon /> },
  { label: 'Inbox', href: '/inbox', icon: <InboxIcon /> },
  { label: 'Projects', href: '/projects', icon: <ProjectsIcon /> },
  { label: 'Household', href: '/household', icon: <HouseholdIcon /> },
  { label: 'Calendar', href: '/calendar', icon: <CalendarIcon /> },
  { label: 'People', href: '/people', icon: <PeopleIcon /> },
  { label: 'Settings', href: '/settings', icon: <SettingsIcon /> },
];

/** Fixed bottom-bar slots flanking the capture FAB. */
export const HOME_NAV_ITEM: NavItem = { label: 'Home', href: '/dashboard', icon: <HomeIcon /> };
export const PROJECTS_NAV_ITEM: NavItem = { label: 'Projects', href: '/projects', icon: <ProjectsIcon /> };

/**
 * The five "secondary" screens. One occupies the customizable second bottom-bar
 * slot (per-device preference, see lib/nav-prefs); the other four fill the "More"
 * overflow sheet.
 */
export const SECONDARY_NAV: Record<SecondNavKey, NavItem> = {
  inbox: { label: 'Inbox', href: '/inbox', icon: <InboxIcon /> },
  household: { label: 'Household', href: '/household', icon: <HouseholdIcon /> },
  calendar: { label: 'Calendar', href: '/calendar', icon: <CalendarIcon /> },
  people: { label: 'People', href: '/people', icon: <PeopleIcon /> },
  settings: { label: 'Settings', href: '/settings', icon: <SettingsIcon /> },
};

/** Display order for pickers and the overflow sheet. */
export const SECOND_NAV_ORDER: SecondNavKey[] = ['inbox', 'household', 'calendar', 'people', 'settings'];
