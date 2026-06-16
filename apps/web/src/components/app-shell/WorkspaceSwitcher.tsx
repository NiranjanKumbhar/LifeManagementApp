'use client';

import { useWorkspace } from '@/lib/workspace-context';
import styles from './WorkspaceSwitcher.module.css';

export function WorkspaceSwitcher() {
  const { workspaceId, workspaces, setActiveWorkspace } = useWorkspace();
  if (workspaces.length <= 1) {
    return <span className={styles.single}>{workspaces[0]?.workspace.name ?? ''}</span>;
  }
  return (
    <label className={styles.wrap}>
      <span className={styles.srOnly}>Workspace</span>
      <select
        className={styles.select}
        value={workspaceId ?? ''}
        onChange={(e) => setActiveWorkspace(e.target.value)}
      >
        {workspaces.map((w) => (
          <option key={w.workspace.id} value={w.workspace.id}>
            {w.workspace.name}
          </option>
        ))}
      </select>
    </label>
  );
}
