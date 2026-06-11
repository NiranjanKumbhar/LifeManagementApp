export type ProjectStatus = 'active' | 'completed' | 'archived' | 'on_hold';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';

export type StockStatus = 'stocked' | 'low' | 'out' | 'on_list';

export type ReminderType = 'standard' | 'lead_time' | 'escalation' | 'recurring';

export type ReminderSeverity = 'info' | 'warning' | 'urgent' | 'critical';

export type NotificationType = 'reminder' | 'partner_action' | 'digest' | 'system';

export type ActivityAction = 'created' | 'updated' | 'completed' | 'archived' | 'deleted';

export type MemberRole = 'owner' | 'member';

export type DigestMode = 'none' | 'daily' | 'weekly';

export type InviteStatus = 'pending' | 'accepted' | 'expired';

export type InboxStatus = 'pending' | 'triaged' | 'dismissed';
