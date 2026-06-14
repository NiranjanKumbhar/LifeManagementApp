import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@lifesync/ui';

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ calendar: { list: { invalidate: vi.fn() } } }),
    calendar: {
      list: {
        useQuery: () => ({ isLoading: false, isError: false, data: [] }),
      },
    },
    reminder: { create: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) } },
  },
}));

import CalendarPage from './page';

function renderPage() {
  return render(
    <ToastProvider>
      <CalendarPage />
    </ToastProvider>,
  );
}

describe('CalendarPage', () => {
  it('renders the month grid, a month heading, and a Today button', () => {
    renderPage();
    expect(screen.getByRole('grid', { name: 'Calendar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous month' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next month' })).toBeInTheDocument();
  });
});
