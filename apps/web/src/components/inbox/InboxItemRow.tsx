import { Button, formatRelativeDate } from '@lifesync/ui';
import styles from './InboxItemRow.module.css';

export interface InboxRowProject {
  id: string;
  title: string;
}

export interface InboxRowItem {
  id: string;
  content: string;
  createdAt: string | Date;
}

export interface InboxItemRowProps {
  item: InboxRowItem;
  projects: InboxRowProject[];
  onAssign: (projectId: string) => void;
  onDismiss: () => void;
  busy?: boolean;
}

export function InboxItemRow({ item, projects, onAssign, onDismiss, busy = false }: InboxItemRowProps) {
  return (
    <li className={styles.row}>
      <div className={styles.main}>
        <p className={styles.content}>{item.content}</p>
        <span className={styles.time}>Captured {formatRelativeDate(item.createdAt)}</span>
      </div>
      <div className={styles.actions}>
        <select
          className={styles.select}
          value=""
          disabled={busy || projects.length === 0}
          aria-label="Move to project"
          onChange={(e) => {
            const projectId = e.target.value;
            if (projectId) onAssign(projectId);
          }}
        >
          <option value="">
            {projects.length === 0 ? 'No projects yet' : 'Move to project…'}
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <Button variant="ghost" size="sm" onClick={onDismiss} disabled={busy}>
          Dismiss
        </Button>
      </div>
    </li>
  );
}
