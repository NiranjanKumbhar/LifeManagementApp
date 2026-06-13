'use client';

import { useState } from 'react';
import type { ProjectType } from '@lifesync/shared-types';
import { Button, Input } from '@lifesync/ui';
import { PROJECT_TYPE_META, PROJECT_TYPE_ORDER } from '@/lib/projects/project-meta';
import styles from './QuickProjectPanel.module.css';

export interface QuickProjectPanelProps {
  capturedText: string;
  busy: boolean;
  onCreate: (name: string, type: ProjectType) => void;
  onCancel: () => void;
}

const TYPE_OPTIONS = PROJECT_TYPE_ORDER.map((t) => ({ value: t, label: PROJECT_TYPE_META[t].label }));

export function QuickProjectPanel({ capturedText, busy, onCreate, onCancel }: QuickProjectPanelProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('general');

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>New project</h2>
      <Input label="Name" value={name} onChange={setName} required placeholder="e.g. Mum's 60th" />
      <Input
        as="select"
        label="Type"
        value={type}
        onChange={(v) => setType(v as ProjectType)}
        options={TYPE_OPTIONS}
      />
      {capturedText ? (
        <p className={styles.preview}>
          First task: <strong>{capturedText}</strong>
        </p>
      ) : null}
      <div className={styles.actions}>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => {
            const trimmed = name.trim();
            if (trimmed) onCreate(trimmed, type);
          }}
          disabled={!name.trim() || busy}
        >
          {busy ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </div>
  );
}
