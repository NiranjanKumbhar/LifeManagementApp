'use client';

import { useMemo, useState } from 'react';
import type { StockStatus, Visibility } from '@lifesync/shared-types';
import {
  EmptyState,
  LoadingSpinner,
  PageHeader,
  PageShell,
  SegmentedControl,
  VisibilityToggle,
  useToast,
} from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { BasketIcon } from '@/components/icons';
import { QuickAddBar } from '@/components/household/QuickAddBar';
import { StockItemRow, type HouseholdItemRow } from '@/components/household/StockItemRow';
import { HouseholdItemForm } from '@/components/household/HouseholdItemForm';
import { groupByCategory, SHOPPING_STATUSES } from '@/lib/household/category-meta';
import styles from './household.module.css';

type Tab = 'shopping' | 'inventory';

export default function HouseholdPage() {
  const workspaceId = useWorkspaceId();
  const enabled = Boolean(workspaceId);
  const toast = useToast();
  const utils = trpc.useUtils();

  const [tab, setTab] = useState<Tab>('shopping');
  const [editing, setEditing] = useState<HouseholdItemRow | null>(null);
  const [addVisibility, setAddVisibility] = useState<Visibility>('shared');

  const query = trpc.household.list.useQuery({ workspaceId: workspaceId ?? '' }, { enabled });

  const invalidate = () => {
    if (workspaceId) void utils.household.list.invalidate({ workspaceId });
  };
  const onError = (e: { message: string }) => toast.error(e.message);

  const add = trpc.household.add.useMutation({ onSuccess: invalidate, onError });
  const purchase = trpc.household.purchase.useMutation({ onSuccess: invalidate, onError });
  const restock = trpc.household.restock.useMutation({ onSuccess: invalidate, onError });
  const update = trpc.household.update.useMutation({ onSuccess: invalidate, onError });

  const items = query.data ?? [];
  const visible = useMemo(
    () => (tab === 'shopping' ? items.filter((i) => SHOPPING_STATUSES.includes(i.status)) : items),
    [items, tab],
  );
  const groups = useMemo(() => groupByCategory(visible), [visible]);

  const onAdd = (name: string) => {
    if (!workspaceId) return;
    add.mutate({
      workspaceId,
      name,
      status: tab === 'shopping' ? 'on_list' : 'stocked',
      visibility: addVisibility,
    });
  };
  const onPrimary = (id: string) =>
    tab === 'shopping' ? purchase.mutate({ id }) : restock.mutate({ id });
  const onSetStatus = (id: string, status: StockStatus) => update.mutate({ id, status });

  return (
    <PageShell>
      <PageHeader
        title="Household"
        subtitle="Groceries and supplies, shared and up to date."
        actions={
          <SegmentedControl
            ariaLabel="Household view"
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            options={[
              { value: 'shopping', label: 'Shopping list' },
              { value: 'inventory', label: 'Inventory' },
            ]}
          />
        }
      />

      <div className={styles.addbar}>
        <QuickAddBar
          onAdd={onAdd}
          placeholder={tab === 'shopping' ? 'Add to shopping list…' : 'Add to inventory…'}
        />
        <VisibilityToggle value={addVisibility} onChange={setAddVisibility} />
      </div>

      {query.isLoading ? (
        <div className={styles.center}>
          <LoadingSpinner size="lg" label="Loading your household" />
        </div>
      ) : query.isError || !query.data ? (
        <div className={styles.center}>
          <EmptyState
            title="We couldn't load your household"
            description={
              workspaceId ? 'Make sure the API is running.' : 'No workspace is configured yet.'
            }
          />
        </div>
      ) : items.length === 0 ? (
        <div className={styles.center}>
          <EmptyState
            title="Nothing tracked yet"
            description="Add your first item with the bar above."
          />
        </div>
      ) : visible.length === 0 ? (
        <div className={styles.center}>
          <EmptyState title="All stocked up 🎉" description="Nothing on the shopping list right now." />
        </div>
      ) : (
        <div className={styles.groups}>
          {groups.map((group) => (
            <section key={group.category} className={styles.group}>
              <h2 className={styles.groupHead}>
                <span className={styles.groupIcon} aria-hidden="true">
                  <BasketIcon size={16} />
                </span>
                {group.category}
                <span className={styles.groupCount}>{group.items.length}</span>
              </h2>
              <div className={styles.list}>
                {group.items.map((item) => (
                  <StockItemRow
                    key={item.id}
                    item={item}
                    tab={tab}
                    onPrimary={onPrimary}
                    onSetStatus={onSetStatus}
                    onEdit={setEditing}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {editing ? (
        <HouseholdItemForm key={editing.id} isOpen item={editing} onClose={() => setEditing(null)} />
      ) : null}
    </PageShell>
  );
}
