import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StockItemRow } from './StockItemRow';

const item = {
  id: 'h1',
  workspaceId: 'ws-1',
  name: 'Bananas',
  category: 'Produce',
  status: 'out' as const,
  quantity: 2,
  unit: 'bunch',
  autoReplenish: false,
  lastPurchased: null,
  addedBy: 'u1',
  lastPurchasedBy: null,
  addedByUser: { id: 'u1', displayName: 'Jordan Lee', avatarUrl: null },
  lastPurchasedByUser: null,
  visibility: 'shared' as const,
  sortOrder: 0,
  createdAt: '2026-06-01',
  updatedAt: '2026-06-01',
};

describe('StockItemRow', () => {
  it('shows the "Got it" action on the shopping tab and fires onPrimary', async () => {
    const onPrimary = vi.fn();
    render(
      <StockItemRow item={item} tab="shopping" onPrimary={onPrimary} onSetStatus={() => {}} onEdit={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(onPrimary).toHaveBeenCalledWith('h1');
  });

  it('shows the "Need more" action on the inventory tab and fires onPrimary', async () => {
    const onPrimary = vi.fn();
    render(
      <StockItemRow item={item} tab="inventory" onPrimary={onPrimary} onSetStatus={() => {}} onEdit={() => {}} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Need more' }));
    expect(onPrimary).toHaveBeenCalledWith('h1');
  });

  it('opens the editor when the name is clicked', async () => {
    const onEdit = vi.fn();
    render(
      <StockItemRow item={item} tab="shopping" onPrimary={() => {}} onSetStatus={() => {}} onEdit={onEdit} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Bananas/ }));
    expect(onEdit).toHaveBeenCalledWith(item);
  });

  it('renders the quantity and unit with a middot separator', () => {
    render(
      <StockItemRow item={item} tab="shopping" onPrimary={() => {}} onSetStatus={() => {}} onEdit={() => {}} />,
    );
    expect(screen.getByText('2 · bunch')).toBeInTheDocument();
  });

  it('shows who added the item', () => {
    render(
      <StockItemRow item={item} tab="shopping" onPrimary={() => {}} onSetStatus={() => {}} onEdit={() => {}} />,
    );
    expect(screen.getByText('Jordan')).toBeInTheDocument();
  });

  it('shows who marked a stocked item as "Got it"', () => {
    const stocked = {
      ...item,
      status: 'stocked' as const,
      lastPurchasedBy: 'u2',
      lastPurchasedByUser: { id: 'u2', displayName: 'Alex Rivera', avatarUrl: null },
    };
    render(
      <StockItemRow item={stocked} tab="inventory" onPrimary={() => {}} onSetStatus={() => {}} onEdit={() => {}} />,
    );
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('shows a lock when the item is private', () => {
    render(
      <StockItemRow
        item={{ ...item, visibility: 'private' }}
        tab="shopping"
        onPrimary={() => {}}
        onSetStatus={() => {}}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByRole('img', { name: 'Private' })).toBeInTheDocument();
  });

  it('shows no lock when the item is shared', () => {
    render(
      <StockItemRow item={item} tab="shopping" onPrimary={() => {}} onSetStatus={() => {}} onEdit={() => {}} />,
    );
    expect(screen.queryByRole('img', { name: 'Private' })).not.toBeInTheDocument();
  });
});
