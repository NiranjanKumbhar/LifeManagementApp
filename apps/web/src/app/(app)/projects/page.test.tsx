import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@lifesync/ui';

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ project: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } } }),
    template: { list: { useQuery: () => ({ data: [] }) } },
    project: {
      list: {
        useQuery: () => ({
          isLoading: false,
          isError: false,
          data: [
            {
              id: 'p1',
              type: 'occasion',
              title: 'Mum 60th',
              dueDate: '2099-01-01',
              ownerId: null,
              status: 'active',
              taskCount: 2,
              completedCount: 1,
            },
            {
              id: 'p2',
              type: 'travel',
              title: 'Japan trip',
              dueDate: null,
              ownerId: null,
              status: 'active',
              taskCount: 0,
              completedCount: 0,
            },
          ],
        }),
      },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import ProjectsPage from './page';

function renderPage() {
  return render(
    <ToastProvider>
      <ProjectsPage />
    </ToastProvider>,
  );
}

describe('ProjectsPage', () => {
  it('groups projects under their type headings', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /Occasions/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Travel/ })).toBeInTheDocument();
    expect(screen.getByText('Mum 60th')).toBeInTheDocument();
    expect(screen.getByText('Japan trip')).toBeInTheDocument();
  });

  it('omits type sections that have no projects', () => {
    renderPage();
    expect(screen.queryByRole('heading', { name: /Compliance/ })).not.toBeInTheDocument();
  });
});
