import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const setSecondNav = vi.fn();
vi.mock('@/lib/nav-prefs', () => ({
  useSecondNav: () => ({ secondNav: 'inbox', setSecondNav }),
}));

import { NavSettings } from './NavSettings';

describe('NavSettings', () => {
  it('changes the second nav button selection', async () => {
    render(<NavSettings />);
    await userEvent.selectOptions(screen.getByLabelText('Second button'), 'calendar');
    expect(setSecondNav).toHaveBeenCalledWith('calendar');
  });
});
