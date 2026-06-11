import { Avatar, EmptyState, formatShortDate } from '@lifesync/ui';
import styles from './list.module.css';

export interface DateItem {
  id: string;
  name: string;
  relationship: string | null;
  birthday: string | null;
  anniversary: string | null;
}

export function DatesList({ items }: { items: DateItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        compact
        title="No dates soon"
        description="No birthdays or anniversaries in the next month."
      />
    );
  }

  return (
    <ul className={styles.list}>
      {items.map((person) => {
        const isBirthday = Boolean(person.birthday);
        const date = person.birthday ?? person.anniversary;
        return (
          <li key={person.id} className={styles.row}>
            <Avatar name={person.name} size="sm" tone="shared" />
            <span className={styles.title}>{person.name}</span>
            <span className={styles.meta}>
              <span className={styles.date}>
                {isBirthday ? 'Birthday' : 'Anniversary'} · {formatShortDate(date)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
