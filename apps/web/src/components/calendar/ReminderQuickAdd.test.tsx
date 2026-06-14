import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const createMutate = vi.fn();
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ calendar: { list: { invalidate: vi.fn() } } }),
    reminder: { create: { useMutation: (o: { onSuccess?: () => void }) => ({ mutate: (v: unknown) => { createMutate(v); o.onSuccess?.(); }, isPending: false }) } },
  },
}));

import { ReminderQuickAdd } from './ReminderQuickAdd';

describe('ReminderQuickAdd', () => {
  it('creates a reminder on the given day', async () => {
    render(
      <ToastProvider>
        <ReminderQuickAdd isOpen day="2026-06-18" onClose={() => {}} />
      </ToastProvider>,
    );
    await userEvent.type(screen.getByRole('textbox'), 'Call plumber');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Call plumber', type: 'standard' }),
    );
    const arg = createMutate.mock.calls[0][0] as { remindAt: string };
    expect(arg.remindAt.startsWith('2026-06-18')).toBe(true);
  });
});
