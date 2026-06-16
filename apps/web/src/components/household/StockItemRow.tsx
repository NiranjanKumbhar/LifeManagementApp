'use client';

import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'api';
import type { StockStatus } from '@lifesync/shared-types';
import { Button, UserChip, formatShortDate } from '@lifesync/ui';
import { LockIcon } from '@/components/icons';
import { StatusPillMenu } from './StatusPillMenu';
import styles from './StockItemRow.module.css';

export type HouseholdItemRow = inferRouterOutputs<AppRouter>['household']['list'][number];

export interface StockItemRowProps {
  item: HouseholdItemRow;
  tab: 'shopping' | 'inventory';
  onPrimary: (id: string) => void;
  onSetStatus: (id: string, status: StockStatus) => void;
  onEdit: (item: HouseholdItemRow) => void;
}

export function StockItemRow({ item, tab, onPrimary, onSetStatus, onEdit }: StockItemRowProps) {
  const measure = [item.quantity != null ? String(item.quantity) : null, item.unit]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={styles.row}>
      <button type="button" className={styles.main} onClick={() => onEdit(item)}>
        <span className={styles.name}>{item.name}</span>
        {item.visibility === 'private' ? (
          <LockIcon size={14} aria-label="Private" aria-hidden="false" role="img" />
        ) : null}
        {measure ? <span className={styles.meta}>{measure}</span> : null}
        {tab === 'inventory' && item.lastPurchased ? (
          <span className={styles.meta}>Last bought {formatShortDate(item.lastPurchased)}</span>
        ) : null}
        <UserChip user={item.addedByUser ?? null} label="Added by" />
        {item.status === 'stocked' && item.lastPurchasedByUser ? (
          <UserChip user={item.lastPurchasedByUser} label="Got it" />
        ) : null}
      </button>
      <div className={styles.controls}>
        <StatusPillMenu status={item.status} onSelect={(s) => onSetStatus(item.id, s)} />
        <Button
          size="sm"
          variant={tab === 'shopping' ? 'primary' : 'ghost'}
          onClick={() => onPrimary(item.id)}
        >
          {tab === 'shopping' ? 'Got it' : 'Need more'}
        </Button>
      </div>
    </div>
  );
}
