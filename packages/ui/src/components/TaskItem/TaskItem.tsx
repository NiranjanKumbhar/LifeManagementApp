import { cn } from '../../utils/cn';
import { formatRelativeDate } from '../../utils/format-date';
import styles from './TaskItem.module.css';

export interface TaskItemData {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  ownerName: string | null;
}

export interface TaskItemProps {
  task: TaskItemData;
  depth: 0 | 1;
  onToggleComplete: (taskId: string) => void;
}

export function TaskItem({ task, depth, onToggleComplete }: TaskItemProps) {
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
      <span className={cn(styles.title, done && styles.done)}>{task.title}</span>
      {task.dueDate ? <span className={styles.due}>{formatRelativeDate(task.dueDate)}</span> : null}
      {task.ownerName ? <span className={styles.owner}>{task.ownerName}</span> : null}
    </div>
  );
}
