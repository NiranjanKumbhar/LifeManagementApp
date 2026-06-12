import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ project: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } } }),
    template: { list: { useQuery: () => ({ data: [] }) } },
    workspace: { members: { useQuery: () => ({ data: [] }) } },
    project: {
      create: { useMutation: (o: { onSuccess?: (d: unknown) => void }) => ({ mutate: () => o.onSuccess?.({ id: 'p9' }), isPending: false }) },
      update: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
    },
  },
}));

import { ProjectForm } from './ProjectForm';

function renderForm() {
  return render(
    <ToastProvider>
      <ProjectForm mode="create" isOpen onClose={() => {}} />
    </ToastProvider>,
  );
}

describe('ProjectForm', () => {
  it('shows core fields', () => {
    renderForm();
    expect(screen.getByLabelText(/Title/)).toBeInTheDocument();
    expect(screen.getByLabelText('Type')).toBeInTheDocument();
  });

  it('renders per-type fields when the type changes to Travel', async () => {
    renderForm();
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'travel');
    expect(screen.getByLabelText('Destination')).toBeInTheDocument();
    expect(screen.getByLabelText('Departure date')).toBeInTheDocument();
  });
});
