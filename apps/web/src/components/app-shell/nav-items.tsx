import type { ReactNode } from 'react';
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

/** Condensed set for the mobile bottom bar (2 + FAB + 2). */
export const bottomNavItems: NavItem[] = [
  { label: 'Home', href: '/dashboard', icon: <HomeIcon /> },
  { label: 'Projects', href: '/projects', icon: <ProjectsIcon /> },
  { label: 'Household', href: '/household', icon: <HouseholdIcon /> },
  { label: 'People', href: '/people', icon: <PeopleIcon /> },
];
