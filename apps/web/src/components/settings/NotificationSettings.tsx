'use client';

import { useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { Input, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useSaveStatus } from '@/lib/settings/useSaveStatus';
import { SectionCard } from './SectionCard';
import styles from './NotificationSettings.module.css';

type Me = inferRouterOutputs<AppRouter>['user']['me'];
type Channels = { push: boolean; email: boolean; inApp: boolean };
type DigestMode = 'none' | 'daily' | 'weekly';
type QuietHours = { start: string; end: string };

const CHANNELS: Array<{ key: keyof Channels; label: string }> = [
  { key: 'push', label: 'Push' },
  { key: 'email', label: 'Email' },
  { key: 'inApp', label: 'In-app' },
];
const DIGEST_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

export function NotificationSettings({ me }: { me: Me }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const save = useSaveStatus();

  const prefs = me.notificationPreferences ?? {};
  const [channels, setChannels] = useState<Channels>(prefs.channels ?? { push: true, email: true, inApp: true });
  const [digestMode, setDigestMode] = useState<DigestMode>((prefs.digestMode as DigestMode) ?? 'none');
  const [quietHours, setQuietHours] = useState<QuietHours>(prefs.quietHours ?? { start: '22:00', end: '07:00' });

  const update = trpc.user.updateNotificationPrefs.useMutation({
    onMutate: () => save.markSaving(),
    onSuccess: () => {
      void utils.user.me.invalidate();
      save.markSaved();
    },
    onError: (e: { message: string }) => {
      toast.error(e.message);
      void utils.user.me.invalidate();
      save.markError();
    },
  });

  const persist = (over: { channels?: Channels; digestMode?: DigestMode; quietHours?: QuietHours }) => {
    update.mutate({
      preferences: {
        channels: over.channels ?? channels,
        digestMode: over.digestMode ?? digestMode,
        quietHours: over.quietHours ?? quietHours,
      },
    });
  };

  const toggleChannel = (key: keyof Channels) => {
    const next = { ...channels, [key]: !channels[key] };
    setChannels(next);
    persist({ channels: next });
  };

  return (
    <SectionCard title="Notifications" status={save.status}>
      <p className={styles.note}>
        Notifications aren&rsquo;t delivered yet — these preferences are saved for when delivery is enabled.
      </p>

      <fieldset className={styles.channels}>
        <legend className={styles.legend}>Channels</legend>
        {CHANNELS.map(({ key, label }) => (
          <label key={key} className={styles.channel}>
            <input type="checkbox" checked={channels[key]} onChange={() => toggleChannel(key)} />
            {label}
          </label>
        ))}
      </fieldset>

      <div className={styles.quiet}>
        <Input
          type="time"
          label="Quiet hours start"
          value={quietHours.start}
          onChange={(start) => {
            const next = { ...quietHours, start };
            setQuietHours(next);
            persist({ quietHours: next });
          }}
        />
        <Input
          type="time"
          label="Quiet hours end"
          value={quietHours.end}
          onChange={(end) => {
            const next = { ...quietHours, end };
            setQuietHours(next);
            persist({ quietHours: next });
          }}
        />
      </div>

      <Input
        as="select"
        label="Digest"
        value={digestMode}
        onChange={(v) => {
          const next = v as DigestMode;
          setDigestMode(next);
          persist({ digestMode: next });
        }}
        options={DIGEST_OPTIONS}
      />
    </SectionCard>
  );
}
