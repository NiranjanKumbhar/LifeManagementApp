import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ project: { list: { invalidate: vi.fn() } } }),
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
    },
  },
}));

import ProjectsPage from './page';

describe('ProjectsPage', () => {
  it('groups projects under their type headings', () => {
    render(<ProjectsPage />);
    expect(screen.getByRole('heading', { name: /Occasions/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Travel/ })).toBeInTheDocument();
    expect(screen.getByText('Mum 60th')).toBeInTheDocument();
    expect(screen.getByText('Japan trip')).toBeInTheDocument();
  });

  it('omits type sections that have no projects', () => {
    render(<ProjectsPage />);
    expect(screen.queryByRole('heading', { name: /Compliance/ })).not.toBeInTheDocument();
  });
});
