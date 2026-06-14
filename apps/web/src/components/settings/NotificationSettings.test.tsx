import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const prefsMutate = vi.fn();
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ user: { me: { invalidate: vi.fn() } } }),
    user: { updateNotificationPrefs: { useMutation: () => ({ mutate: prefsMutate, isPending: false }) } },
  },
}));

import { NotificationSettings } from './NotificationSettings';

const me = {
  id: 'u1', displayName: 'Alex', email: 'a@b.com', timezone: 'UTC',
  notificationPreferences: {
    channels: { push: true, email: true, inApp: true },
    digestMode: 'none',
    quietHours: { start: '22:00', end: '07:00' },
  },
};

function renderIt() {
  return render(
    <ToastProvider>
      <NotificationSettings me={me as never} />
    </ToastProvider>,
  );
}

describe('NotificationSettings', () => {
  it('toggling a channel saves the FULL preferences object', async () => {
    renderIt();
    await userEvent.click(screen.getByRole('checkbox', { name: /push/i }));
    expect(prefsMutate).toHaveBeenCalledWith({
      preferences: {
        channels: { push: false, email: true, inApp: true },
        digestMode: 'none',
        quietHours: { start: '22:00', end: '07:00' },
      },
    });
  });

  it('shows the not-delivered note', () => {
    renderIt();
    expect(screen.getByText(/aren.t delivered yet/i)).toBeInTheDocument();
  });
});
