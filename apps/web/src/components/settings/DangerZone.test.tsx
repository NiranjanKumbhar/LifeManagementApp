import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const deleteMutate = vi.fn();
const clearMutate = vi.fn();
const signOut = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@clerk/nextjs', () => ({ useClerk: () => ({ signOut }) }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ workspace: { mine: { invalidate: vi.fn() } } }),
    account: {
      delete: {
        useMutation: (o: { onSuccess?: () => void }) => ({
          mutate: () => {
            deleteMutate();
            o.onSuccess?.();
          },
          isPending: false,
        }),
      },
      clearData: {
        useMutation: (o: { onSuccess?: () => void }) => ({
          mutate: () => {
            clearMutate();
            o.onSuccess?.();
          },
          isPending: false,
        }),
      },
    },
  },
}));

import { DangerZone } from './DangerZone';

const renderIt = () =>
  render(
    <ToastProvider>
      <DangerZone email="me@example.com" />
    </ToastProvider>,
  );

describe('DangerZone', () => {
  it('requires the matching email before deleting, then deletes + signs out', async () => {
    renderIt();
    await userEvent.click(screen.getByRole('button', { name: /^delete account$/i }));
    const confirmBtn = screen.getByRole('button', { name: /permanently delete/i });
    expect(confirmBtn).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/type your email/i), 'me@example.com');
    expect(confirmBtn).toBeEnabled();

    await userEvent.click(confirmBtn);
    expect(deleteMutate).toHaveBeenCalled();
    expect(signOut).toHaveBeenCalled();
  });

  it('clears data on confirm', async () => {
    renderIt();
    await userEvent.click(screen.getByRole('button', { name: /clear my data/i }));
    await userEvent.click(screen.getByRole('button', { name: /yes, clear/i }));
    expect(clearMutate).toHaveBeenCalled();
  });
});
