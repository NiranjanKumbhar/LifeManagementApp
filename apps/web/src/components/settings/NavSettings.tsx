'use client';

import { Input } from '@lifesync/ui';
import { useSecondNav, type SecondNavKey } from '@/lib/nav-prefs';
import { SECONDARY_NAV, SECOND_NAV_ORDER } from '@/components/app-shell/nav-items';
import { SectionCard } from './SectionCard';

export function NavSettings() {
  const { secondNav, setSecondNav } = useSecondNav();
  const options = SECOND_NAV_ORDER.map((k) => ({ value: k, label: SECONDARY_NAV[k].label }));
  return (
    <SectionCard title="Bottom bar">
      <Input
        as="select"
        label="Second button"
        value={secondNav}
        onChange={(v) => setSecondNav(v as SecondNavKey)}
        options={options}
        helperText="Shown in the bottom navigation on smaller screens."
      />
    </SectionCard>
  );
}
