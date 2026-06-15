import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('./AccountControl', () => ({ AccountControl: () => <div>account-control</div> }));

import { NavPrefsProvider } from '@/lib/nav-prefs';
import { MoreSheet } from './MoreSheet';

const renderSheet = (props: { open: boolean; onClose: () => void }) =>
  render(
    <NavPrefsProvider>
      <MoreSheet {...props} />
    </NavPrefsProvider>,
  );

describe('MoreSheet', () => {
  beforeEach(() => localStorage.clear());

  it('renders nothing when closed', () => {
    const { container } = renderSheet({ open: false, onClose: () => {} });
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the overflow destinations (excluding the promoted screen) and the account', () => {
    renderSheet({ open: true, onClose: () => {} });
    expect(screen.getByRole('link', { name: /Household/i })).toHaveAttribute('href', '/household');
    expect(screen.getByRole('link', { name: /Calendar/i })).toHaveAttribute('href', '/calendar');
    expect(screen.getByRole('link', { name: /People/i })).toHaveAttribute('href', '/people');
    expect(screen.getByRole('link', { name: /Settings/i })).toHaveAttribute('href', '/settings');
    // Inbox is the default second button, so it is NOT in the overflow.
    expect(screen.queryByRole('link', { name: /Inbox/i })).not.toBeInTheDocument();
    expect(screen.getByText('account-control')).toBeInTheDocument();
  });

  it('closes on backdrop click', async () => {
    const onClose = vi.fn();
    renderSheet({ open: true, onClose });
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    renderSheet({ open: true, onClose });
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
