import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const createMutate = vi.fn();
const setActiveWorkspace = vi.fn();
vi.mock('@/lib/workspace-context', () => ({ useWorkspace: () => ({ setActiveWorkspace }) }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ workspace: { mine: { invalidate: vi.fn() } } }),
    workspace: {
      create: {
        useMutation: (o: { onSuccess?: (ws: { id: string; name: string }) => void }) => ({
          mutate: (...a: unknown[]) => {
            createMutate(...a);
            o.onSuccess?.({ id: 'w-new', name: 'My Home' });
          },
          isPending: false,
        }),
      },
    },
  },
}));

import { NoWorkspace } from './NoWorkspace';

function renderIt() {
  return render(
    <ToastProvider>
      <NoWorkspace />
    </ToastProvider>,
  );
}

describe('NoWorkspace', () => {
  it('creates a workspace with the entered name and switches to it', async () => {
    renderIt();
    await userEvent.type(screen.getByLabelText(/workspace name/i), 'My Home');
    await userEvent.click(screen.getByRole('button', { name: /create workspace/i }));
    expect(createMutate).toHaveBeenCalledWith({ name: 'My Home' });
    expect(setActiveWorkspace).toHaveBeenCalledWith('w-new');
  });

  it('routes to the join page when an invite link is pasted', async () => {
    renderIt();
    await userEvent.type(
      screen.getByLabelText(/invite link/i),
      'https://lifesync-mu.vercel.app/join/tok123',
    );
    await userEvent.click(screen.getByRole('button', { name: /join/i }));
    expect(push).toHaveBeenCalledWith('/join/tok123');
  });

  it('accepts a raw token too', async () => {
    renderIt();
    await userEvent.type(screen.getByLabelText(/invite link/i), 'rawTokenXYZ');
    await userEvent.click(screen.getByRole('button', { name: /join/i }));
    expect(push).toHaveBeenCalledWith('/join/rawTokenXYZ');
  });
});
