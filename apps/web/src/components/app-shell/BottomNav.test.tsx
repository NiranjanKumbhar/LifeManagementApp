import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('./AccountControl', () => ({ AccountControl: () => <div>account</div> }));

import { NavPrefsProvider } from '@/lib/nav-prefs';
import { BottomNav } from './BottomNav';

const renderNav = () =>
  render(
    <NavPrefsProvider>
      <BottomNav onQuickCapture={() => {}} />
    </NavPrefsProvider>,
  );

describe('BottomNav', () => {
  beforeEach(() => localStorage.clear());

  it('renders Home, Inbox, Projects tabs, the capture FAB, and a More button', () => {
    renderNav();
    expect(screen.getByRole('link', { name: /Home/i })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /Inbox/i })).toHaveAttribute('href', '/inbox');
    expect(screen.getByRole('link', { name: /Projects/i })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('button', { name: /Quick capture/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /More/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Household/i })).not.toBeInTheDocument();
  });

  it('opens the More sheet with Household, Calendar, People, and Settings', async () => {
    renderNav();
    await userEvent.click(screen.getByRole('button', { name: /More/i }));
    expect(screen.getByRole('link', { name: /Household/i })).toHaveAttribute('href', '/household');
    expect(screen.getByRole('link', { name: /Calendar/i })).toHaveAttribute('href', '/calendar');
    expect(screen.getByRole('link', { name: /People/i })).toHaveAttribute('href', '/people');
    expect(screen.getByRole('link', { name: /Settings/i })).toHaveAttribute('href', '/settings');
  });

  it('shows the chosen second button instead of Inbox', () => {
    localStorage.setItem('ls-second-nav', 'calendar');
    renderNav();
    expect(screen.getByRole('link', { name: /Calendar/i })).toHaveAttribute('href', '/calendar');
    expect(screen.queryByRole('link', { name: /Inbox/i })).not.toBeInTheDocument();
  });
});
