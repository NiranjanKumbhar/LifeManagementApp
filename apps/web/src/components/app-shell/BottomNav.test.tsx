import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));

import { BottomNav } from './BottomNav';

describe('BottomNav', () => {
  it('renders the primary tabs and a More button', () => {
    render(<BottomNav onQuickCapture={() => {}} />);
    expect(screen.getByRole('link', { name: /Home/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Projects/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /More/i })).toBeInTheDocument();
  });

  it('opens the More sheet with Calendar, People, and Settings', async () => {
    render(<BottomNav onQuickCapture={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /More/i }));
    expect(screen.getByRole('link', { name: /Calendar/i })).toHaveAttribute('href', '/calendar');
    expect(screen.getByRole('link', { name: /People/i })).toHaveAttribute('href', '/people');
    expect(screen.getByRole('link', { name: /Settings/i })).toHaveAttribute('href', '/settings');
  });
});
