import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const purchaseMutate = vi.fn();
const addMutate = vi.fn();

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => {
  const item = (over: Record<string, unknown>) => ({
    id: 'x',
    workspaceId: 'ws-1',
    name: 'Item',
    category: 'Other',
    status: 'stocked',
    quantity: null,
    unit: null,
    autoReplenish: false,
    lastPurchased: null,
    addedBy: null,
    sortOrder: 0,
    createdAt: '2026-06-01',
    updatedAt: '2026-06-01',
    ...over,
  });
  return {
    trpc: {
      useUtils: () => ({ household: { list: { invalidate: vi.fn() } } }),
      household: {
        list: {
          useQuery: () => ({
            isLoading: false,
            isError: false,
            data: [
              item({ id: 'b', name: 'Bananas', category: 'Produce', status: 'out' }),
              item({ id: 'm', name: 'Milk', category: 'Dairy', status: 'stocked' }),
              item({ id: 's', name: 'Spinach', category: 'Produce', status: 'low' }),
            ],
          }),
        },
        add: { useMutation: () => ({ mutate: addMutate, isPending: false }) },
        update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
        purchase: { useMutation: () => ({ mutate: purchaseMutate, isPending: false }) },
        restock: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      },
    },
  };
});

import HouseholdPage from './page';

function renderPage() {
  return render(
    <ToastProvider>
      <HouseholdPage />
    </ToastProvider>,
  );
}

describe('HouseholdPage', () => {
  it('shows only shopping-list items (out/low/on_list) grouped by category by default', () => {
    renderPage();
    expect(screen.getByText('Bananas')).toBeInTheDocument();
    expect(screen.getByText('Spinach')).toBeInTheDocument();
    expect(screen.queryByText('Milk')).not.toBeInTheDocument(); // stocked → inventory only
    expect(screen.getByRole('heading', { name: /Produce/ })).toBeInTheDocument();
  });

  it('fires the purchase mutation when "Got it" is clicked', async () => {
    renderPage();
    const bananas = screen.getByText('Bananas').closest('div');
    await userEvent.click(within(bananas as HTMLElement).getByRole('button', { name: 'Got it' }));
    expect(purchaseMutate).toHaveBeenCalledWith({ id: 'b' });
  });

  it('quick-adds a shopping item with the on_list default status', async () => {
    renderPage();
    await userEvent.type(screen.getByRole('textbox', { name: /add item/i }), 'Eggs{Enter}');
    expect(addMutate).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', name: 'Eggs', status: 'on_list' }),
    );
  });

  it('switches to the Inventory tab and shows stocked items', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Inventory' }));
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Bananas')).toBeInTheDocument(); // inventory shows all
  });
});
