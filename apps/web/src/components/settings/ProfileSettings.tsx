'use client';

import { useState } from 'react';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import { Input, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useSaveStatus } from '@/lib/settings/useSaveStatus';
import { listTimeZones } from '@/lib/settings/timezones';
import { SectionCard } from './SectionCard';

type Me = inferRouterOutputs<AppRouter>['user']['me'];

export function ProfileSettings({ me }: { me: Me }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const save = useSaveStatus();
  const [name, setName] = useState(me.displayName);

  const update = trpc.user.updateProfile.useMutation({
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

  const tzOptions = listTimeZones().map((z) => ({ value: z, label: z }));

  return (
    <SectionCard title="Profile" status={save.status}>
      <Input
        label="Display name"
        value={name}
        onChange={setName}
        onBlur={() => {
          const trimmed = name.trim();
          if (trimmed && trimmed !== me.displayName) update.mutate({ displayName: trimmed });
        }}
      />
      <Input
        as="select"
        label="Timezone"
        value={me.timezone}
        onChange={(tz) => update.mutate({ timezone: tz })}
        options={tzOptions}
      />
      <Input
        label="Email"
        value={me.email}
        onChange={() => {}}
        disabled
        helperText="Managed by your account."
      />
    </SectionCard>
  );
}
