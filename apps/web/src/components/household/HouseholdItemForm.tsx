'use client';

import { useState } from 'react';
import type { StockStatus } from '@lifesync/shared-types';
import { Button, Input, Modal, useToast } from '@lifesync/ui';
import { trpc } from '@/lib/trpc';
import { useWorkspaceId } from '@/lib/hooks/useWorkspaceId';
import { HOUSEHOLD_CATEGORY_ORDER, HOUSEHOLD_STATUS_META } from '@/lib/household/category-meta';
import type { HouseholdItemRow } from './StockItemRow';
import styles from './HouseholdItemForm.module.css';

export interface HouseholdItemFormProps {
  isOpen: boolean;
  item: HouseholdItemRow | null;
  onClose: () => void;
}

const STATUS_OPTIONS = (Object.keys(HOUSEHOLD_STATUS_META) as StockStatus[]).map((s) => ({
  value: s,
  label: HOUSEHOLD_STATUS_META[s].label,
}));

const CATEGORY_OPTIONS = HOUSEHOLD_CATEGORY_ORDER.map((c) => ({ value: c, label: c }));

export function HouseholdItemForm({ isOpen, item, onClose }: HouseholdItemFormProps) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const utils = trpc.useUtils();

  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState(item?.category ?? 'Other');
  const [status, setStatus] = useState<StockStatus>(item?.status ?? 'stocked');
  const [quantity, setQuantity] = useState(item?.quantity != null ? String(item.quantity) : '');
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [autoReplenish, setAutoReplenish] = useState(item?.autoReplenish ? 'true' : 'false');

  const update = trpc.household.update.useMutation({
    onSuccess: () => {
      if (workspaceId) void utils.household.list.invalidate({ workspaceId });
      toast.success('Item updated');
      onClose();
    },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  const submit = () => {
    if (!item || !name.trim() || update.isPending) return;
    update.mutate({
      id: item.id,
      name: name.trim(),
      category,
      status,
      quantity: quantity === '' ? null : Number(quantity),
      unit: unit.trim() === '' ? null : unit.trim(),
      autoReplenish: autoReplenish === 'true',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit item"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Input label="Name" value={name} onChange={setName} required />
        <Input as="select" label="Category" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        <Input
          as="select"
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as StockStatus)}
          options={STATUS_OPTIONS}
        />
        <Input type="number" label="Quantity" value={quantity} onChange={setQuantity} />
        <Input label="Unit" value={unit} onChange={setUnit} placeholder="e.g. bunch, litre" />
        <Input
          as="select"
          label="Auto-replenish"
          value={autoReplenish}
          onChange={setAutoReplenish}
          options={[
            { value: 'false', label: 'No' },
            { value: 'true', label: 'Yes' },
          ]}
        />
      </div>
    </Modal>
  );
}
