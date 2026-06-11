import { Badge, EmptyState } from '@lifesync/ui';
import styles from './list.module.css';

export interface StockItem {
  id: string;
  name: string;
  status: string;
}

const LABEL: Record<string, string> = { out: 'Out', low: 'Low', on_list: 'On list' };

export function StockList({ items }: { items: StockItem[] }) {
  if (items.length === 0) {
    return <EmptyState compact title="Fully stocked" description="Nothing is running low right now." />;
  }

  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item.id} className={styles.row}>
          <span className={styles.title}>{item.name}</span>
          <span className={styles.meta}>
            <Badge tone={item.status === 'out' ? 'overdue' : 'soon'}>
              {LABEL[item.status] ?? item.status}
            </Badge>
          </span>
        </li>
      ))}
    </ul>
  );
}
