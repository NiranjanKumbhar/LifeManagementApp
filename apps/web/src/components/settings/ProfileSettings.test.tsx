import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@lifesync/ui';

const profileMutate = vi.fn();
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ user: { me: { invalidate: vi.fn() } } }),
    user: { updateProfile: { useMutation: () => ({ mutate: profileMutate, isPending: false }) } },
  },
}));

import { ProfileSettings } from './ProfileSettings';

const me = {
  id: 'u1', displayName: 'Alex', email: 'alex@example.com', timezone: 'Europe/London',
  notificationPreferences: {},
};

function renderIt() {
  return render(
    <ToastProvider>
      <ProfileSettings me={me as never} />
    </ToastProvider>,
  );
}

describe('ProfileSettings', () => {
  it('saves the display name on blur', async () => {
    renderIt();
    const name = screen.getByLabelText('Display name');
    await userEvent.clear(name);
    await userEvent.type(name, 'Alexandra');
    await userEvent.tab();
    expect(profileMutate).toHaveBeenCalledWith({ displayName: 'Alexandra' });
  });

  it('saves the timezone on change', async () => {
    renderIt();
    await userEvent.selectOptions(screen.getByLabelText('Timezone'), 'UTC');
    expect(profileMutate).toHaveBeenCalledWith({ timezone: 'UTC' });
  });

  it('shows the email as read-only', () => {
    renderIt();
    expect(screen.getByLabelText('Email')).toBeDisabled();
  });
});
