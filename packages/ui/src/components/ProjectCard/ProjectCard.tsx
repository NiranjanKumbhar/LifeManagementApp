import type { ElementType, ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { formatRelativeDate, daysUntil } from '../../utils/format-date';
import { urgencyStyle, urgencyFromDays } from '../../utils/urgency-color';
import styles from './ProjectCard.module.css';

export interface ProjectCardData {
  title: string;
  dueDate: string | null;
  ownerName: string | null;
  taskCount: number;
  completedCount: number;
}

export interface ProjectCardProps {
  project: ProjectCardData;
  href: string;
  icon?: ReactNode;
  as?: ElementType;
}

export function ProjectCard({ project, href, icon, as: Component = 'a' }: ProjectCardProps) {
  const { title, dueDate, ownerName, taskCount, completedCount } = project;
  const urgency = urgencyStyle(urgencyFromDays(daysUntil(dueDate)));
  const pct = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;

  return (
    <Component className={styles.card} href={href}>
      <div className={styles.head}>
        {icon ? (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span className={styles.title}>{title}</span>
      </div>

      <div className={styles.meta}>
        {dueDate ? (
          <span
            className={styles.due}
            style={{ color: urgency.color, background: urgency.soft }}
          >
            {formatRelativeDate(dueDate)}
          </span>
        ) : null}
        {ownerName ? <span className={styles.owner}>{ownerName}</span> : null}
      </div>

      {taskCount > 0 ? (
        <div className={styles.progress}>
          <div className={styles.track}>
            <div className={cn(styles.fill)} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.count}>
            {completedCount}/{taskCount}
          </span>
        </div>
      ) : (
        <span className={styles.noTasks}>No tasks</span>
      )}
    </Component>
  );
}
