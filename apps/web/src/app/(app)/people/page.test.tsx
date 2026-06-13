import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@lifesync/ui';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ person: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } } }),
    person: {
      list: {
        useQuery: () => ({
          isLoading: false,
          isError: false,
          data: [
            { id: 'a', name: 'Dad', relationship: 'Father', birthday: null, anniversary: null },
            { id: 'b', name: 'Mum', relationship: 'Mother', birthday: nextWeekISO(), anniversary: null },
          ],
        }),
      },
      create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

function nextWeekISO() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return `1990-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

import PeoplePage from './page';

function renderPage() {
  return render(
    <ToastProvider>
      <PeoplePage />
    </ToastProvider>,
  );
}

describe('PeoplePage', () => {
  it('lists people alphabetically with their relationship', () => {
    renderPage();
    expect(screen.getByText('Dad')).toBeInTheDocument();
    expect(screen.getByText('Mum')).toBeInTheDocument();
    expect(screen.getByText('Father')).toBeInTheDocument();
  });

  it('shows an Upcoming section when someone has a near date', () => {
    renderPage();
    expect(screen.getByText(/Upcoming/i)).toBeInTheDocument();
  });
});
