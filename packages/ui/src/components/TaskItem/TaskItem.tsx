import type { UserRef, Visibility } from '@lifesync/shared-types';
import { cn } from '../../utils/cn';
import { formatRelativeDate } from '../../utils/format-date';
import { UserChip } from '../UserChip/UserChip';
import { PrivacyLock } from '../PrivacyLock/PrivacyLock';
import styles from './TaskItem.module.css';

export interface TaskItemData {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  createdByUser: UserRef | null;
  completedByUser: UserRef | null;
  visibility?: Visibility;
}

export interface TaskItemProps {
  task: TaskItemData;
  depth: 0 | 1;
  onToggleComplete: (taskId: string) => void;
  onEdit?: (taskId: string) => void;
}

export function TaskItem({ task, depth, onToggleComplete, onEdit }: TaskItemProps) {
  const done = task.status === 'completed';
  return (
    <div className={cn(styles.row, depth === 1 && styles.nested)}>
      <input
        type="checkbox"
        className={styles.checkbox}
        checked={done}
        aria-label={task.title}
        onChange={() => onToggleComplete(task.id)}
      />
      {onEdit ? (
        <button
          type="button"
          className={cn(styles.titleButton, done && styles.done)}
          onClick={() => onEdit(task.id)}
        >
          {task.title}
        </button>
      ) : (
        <span className={cn(styles.title, done && styles.done)}>{task.title}</span>
      )}
      {task.visibility === 'private' ? <PrivacyLock /> : null}
      {task.dueDate ? <span className={styles.due}>{formatRelativeDate(task.dueDate)}</span> : null}
      {task.createdByUser ? <UserChip user={task.createdByUser} /> : null}
      {task.status === 'completed' && task.completedByUser ? (
        <UserChip user={task.completedByUser} label="Done by" />
      ) : null}
    </div>
  );
}
