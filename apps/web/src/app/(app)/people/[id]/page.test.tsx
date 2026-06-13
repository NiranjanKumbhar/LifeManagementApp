import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const updateMutate = vi.fn();
const deleteMutate = vi.fn();
const push = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'p1' }),
  useRouter: () => ({ push }),
}));
vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ person: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } } }),
    person: {
      get: {
        useQuery: () => ({
          isLoading: false,
          isError: false,
          data: {
            id: 'p1',
            name: 'Mum',
            relationship: 'Mother',
            birthday: '1960-07-14',
            anniversary: null,
            email: 'mum@example.com',
            phone: null,
            notes: 'Loves jazz',
            giftIdeas: [{ idea: 'Headphones', budget: 120, purchased: false }],
            projects: [],
          },
        }),
      },
      update: { useMutation: () => ({ mutate: updateMutate, isPending: false }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      delete: { useMutation: (o: { onSuccess?: () => void }) => ({ mutate: (v: unknown) => { deleteMutate(v); o.onSuccess?.(); }, isPending: false }) },
    },
  },
}));

import PersonDetailPage from './page';

function renderPage() {
  return render(
    <ToastProvider>
      <PersonDetailPage />
    </ToastProvider>,
  );
}

describe('PersonDetailPage', () => {
  it('renders the profile and gift ideas', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Mum' })).toBeInTheDocument();
    expect(screen.getByText('Headphones')).toBeInTheDocument();
  });

  it('toggling a gift idea saves via person.update', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('checkbox', { name: /Headphones/ }));
    expect(updateMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'p1',
        giftIdeas: [{ idea: 'Headphones', budget: 120, purchased: true }],
      }),
    );
  });

  it('deleting after confirm calls person.delete and navigates away', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(deleteMutate).toHaveBeenCalledWith({ id: 'p1' });
    expect(push).toHaveBeenCalledWith('/people');
  });
});
