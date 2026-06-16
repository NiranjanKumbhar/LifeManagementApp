import type { Visibility } from '@lifesync/shared-types';
import { cn } from '../../utils/cn';
import styles from '../SegmentedControl/SegmentedControl.module.css';

export interface VisibilityToggleProps {
  value: Visibility;
  onChange: (value: Visibility) => void;
}

const OPTIONS: Array<{ value: Visibility; label: string }> = [
  { value: 'shared', label: 'Shared' },
  { value: 'private', label: 'Private' },
];

export function VisibilityToggle({ value, onChange }: VisibilityToggleProps) {
  return (
    <div className={styles.root} aria-label="Visibility">
      {OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            className={cn(styles.segment, selected && styles.selected)}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
