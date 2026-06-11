import type { DigestMode } from '../enums/status';

export interface NotificationChannels {
  push: boolean;
  email: boolean;
  inApp: boolean;
}

export interface QuietHours {
  start: string; // HH:mm
  end: string;   // HH:mm
}

export interface NotificationPreferences {
  quietHours?: QuietHours;
  digestMode?: DigestMode;
  channels?: NotificationChannels;
}

export interface User {
  id: string;
  clerkId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  timezone: string;
  notificationPreferences: NotificationPreferences;
  createdAt: Date;
  updatedAt: Date;
}
