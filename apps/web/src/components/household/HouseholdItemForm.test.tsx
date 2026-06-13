import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const mutate = vi.fn();
vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ household: { list: { invalidate: vi.fn() } } }),
    household: { update: { useMutation: () => ({ mutate, isPending: false }) } },
  },
}));

import { HouseholdItemForm } from './HouseholdItemForm';

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

describe('HouseholdItemForm', () => {
  it('submits an update with the edited name', async () => {
    render(
      <ToastProvider>
        <HouseholdItemForm isOpen item={item} onClose={() => {}} />
      </ToastProvider>,
    );
    const name = screen.getByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Plantains');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ id: 'h1', name: 'Plantains' }));
  });
});
