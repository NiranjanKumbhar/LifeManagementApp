'use client';

import { SegmentedControl } from '@lifesync/ui';
import { useTheme, type ThemeMode } from '@/lib/theme';
import { SectionCard } from './SectionCard';

const THEME_OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function AppearanceSettings() {
  const { mode, setMode } = useTheme();
  return (
    <SectionCard title="Appearance">
      <SegmentedControl
        options={THEME_OPTIONS}
        value={mode}
        onChange={(v) => setMode(v as ThemeMode)}
        ariaLabel="Color theme"
      />
    </SectionCard>
  );
}
