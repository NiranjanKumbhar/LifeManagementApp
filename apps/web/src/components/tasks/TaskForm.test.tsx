import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const updateMutate = vi.fn();
const createReminderMutate = vi.fn();
const dismissReminderMutate = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      project: { get: { invalidate: vi.fn() } },
      reminder: { list: { invalidate: vi.fn() } },
    }),
    workspace: {
      members: {
        useQuery: () => ({
          data: [{ user: { id: 'u1', displayName: 'Alex' } }, { user: { id: 'u2', displayName: 'Jordan' } }],
        }),
      },
    },
    reminder: {
      list: { useQuery: () => ({ data: [{ id: 'r1', taskId: 't1', remindAt: '2026-07-01T09:00:00.000Z' }] }) },
      create: { useMutation: () => ({ mutate: createReminderMutate, isPending: false }) },
      dismiss: { useMutation: () => ({ mutate: dismissReminderMutate, isPending: false }) },
    },
    task: {
      update: { useMutation: (o: { onSuccess?: () => void }) => ({ mutate: (...a: unknown[]) => { updateMutate(...a); o.onSuccess?.(); }, isPending: false }) },
    },
  },
}));

import { TaskForm } from './TaskForm';

const task = {
  id: 't1',
  title: 'Book appointment',
  description: 'Call the office',
  status: 'pending',
  dueDate: '2026-07-10',
  priority: 'medium',
  ownerId: 'u1',
  children: [],
};

function renderForm() {
  return render(
    <ToastProvider>
      <TaskForm
        isOpen
        onClose={() => {}}
        task={task as never}
        projectId="p1"
        workspaceId="ws-1"
      />
    </ToastProvider>,
  );
}

describe('TaskForm', () => {
  it('seeds fields from the task', () => {
    renderForm();
    expect(screen.getByLabelText(/Title/)).toHaveValue('Book appointment');
    expect(screen.getByLabelText('Due date')).toHaveValue('2026-07-10');
  });

  it('clearing the due date saves dueDate: null', async () => {
    renderForm();
    await userEvent.clear(screen.getByLabelText('Due date'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateMutate).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', dueDate: null }));
  });

  it('lists existing reminders and dismisses one', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: /remove reminder/i }));
    expect(dismissReminderMutate).toHaveBeenCalledWith({ id: 'r1' });
  });

  it('adds a reminder from the datetime field', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('Remind me at'), '2026-08-01T09:00');
    await userEvent.click(screen.getByRole('button', { name: 'Add reminder' }));
    expect(createReminderMutate).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 't1', remindAt: expect.any(String) }),
    );
  });
});
