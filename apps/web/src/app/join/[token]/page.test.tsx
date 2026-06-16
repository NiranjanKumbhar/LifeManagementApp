import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useParams: () => ({ token: 'tok' }),
  useRouter: () => ({ push }),
}));

const acceptMutate = vi.fn();
const setActiveWorkspace = vi.fn();
vi.mock('@/lib/workspace-context', () => ({ useWorkspace: () => ({ setActiveWorkspace }) }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    workspace: {
      invitePreview: { useQuery: () => ({ data: { workspaceName: 'Beach House', status: 'pending' }, isLoading: false, isError: false }) },
      acceptInvite: { useMutation: (o: { onSuccess?: (ws: { id: string; name: string }) => void }) => ({
        mutate: (...a: unknown[]) => { acceptMutate(...a); o.onSuccess?.({ id: 'w9', name: 'Beach House' }); },
        isPending: false,
      }) },
    },
  },
}));

import JoinPage from './page';

function renderPage() {
  return render(<ToastProvider><JoinPage /></ToastProvider>);
}

describe('JoinPage', () => {
  it('shows the workspace name and accepts the invite', async () => {
    renderPage();
    expect(screen.getByText(/Beach House/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /join/i }));
    expect(acceptMutate).toHaveBeenCalledWith({ token: 'tok' });
    expect(setActiveWorkspace).toHaveBeenCalledWith('w9');
  });
});
