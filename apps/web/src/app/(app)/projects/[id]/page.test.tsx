import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const completeMutate = vi.fn();

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'p1' }) }));
vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ project: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } } }),
    template: { list: { useQuery: () => ({ data: [] }) } },
    project: {
      get: {
        useQuery: () => ({
          isLoading: false,
          isError: false,
          data: {
            id: 'p1',
            type: 'occasion',
            title: 'Mum 60th',
            description: 'Surprise dinner',
            dueDate: '2099-01-01',
            priority: 'medium',
            visibility: 'shared',
            ownerId: null,
            customFields: { venue: 'The Ivy' },
            tasks: [
              { id: 't1', title: 'Book restaurant', status: 'completed', dueDate: null, ownerId: null, children: [] },
              { id: 't2', title: 'Send invites', status: 'pending', dueDate: null, ownerId: null, children: [] },
            ],
          },
        }),
      },
      complete: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      archive: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
    task: {
      complete: { useMutation: (o: { onSuccess?: () => void }) => ({ mutate: (v: unknown) => { completeMutate(v); o.onSuccess?.(); }, isPending: false }) },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import ProjectDetailPage from './page';

function renderPage() {
  return render(
    <ToastProvider>
      <ProjectDetailPage />
    </ToastProvider>,
  );
}

describe('ProjectDetailPage', () => {
  it('renders the project title and its tasks', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Mum 60th/ })).toBeInTheDocument();
    expect(screen.getByText('Book restaurant')).toBeInTheDocument();
    expect(screen.getByText('Send invites')).toBeInTheDocument();
  });

  it('completes a task when its checkbox is toggled', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('checkbox', { name: /send invites/i }));
    expect(completeMutate).toHaveBeenCalledWith({ id: 't2' });
  });
});
