import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const createMutate = vi.fn();
vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ person: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } } }),
    person: {
      create: { useMutation: () => ({ mutate: createMutate, isPending: false }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import { PersonForm } from './PersonForm';

describe('PersonForm', () => {
  it('creates a person with the entered name and relationship', async () => {
    render(
      <ToastProvider>
        <PersonForm mode="create" isOpen onClose={() => {}} />
      </ToastProvider>,
    );
    await userEvent.type(screen.getByLabelText(/Name/), 'Mum');
    await userEvent.type(screen.getByLabelText('Relationship'), 'Mother');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-1', name: 'Mum', relationship: 'Mother' }),
    );
  });
});
