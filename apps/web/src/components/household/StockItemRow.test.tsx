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
  addedBy: null,
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
});
