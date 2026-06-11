import {
  EmptyState,
  PartnerBadge,
  UrgencyIndicator,
  daysUntil,
  formatRelativeDate,
  urgencyFromDays,
  type Ownership,
} from '@lifesync/ui';
import styles from './list.module.css';

export interface DeadlineItem {
  id: string;
  title: string;
  dueDate: string | null;
}

export interface DeadlineListProps {
  items: DeadlineItem[];
  ownership?: Ownership;
  emptyTitle: string;
  emptyDescription?: string;
}

export function DeadlineList({ items, ownership, emptyTitle, emptyDescription }: DeadlineListProps) {
  if (items.length === 0) {
    return <EmptyState compact title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id} className={styles.row}>
          <UrgencyIndicator level={urgencyFromDays(daysUntil(item.dueDate))} showLabel={false} />
          <span className={styles.title}>{item.title}</span>
          <span className={styles.meta}>
            {item.dueDate ? (
              <span className={styles.date}>{formatRelativeDate(item.dueDate)}</span>
            ) : null}
            {ownership ? <PartnerBadge ownership={ownership} /> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
