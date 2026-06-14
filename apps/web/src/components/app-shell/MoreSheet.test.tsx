import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));

import { MoreSheet } from './MoreSheet';

describe('MoreSheet', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<MoreSheet open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the overflow destinations when open', () => {
    render(<MoreSheet open onClose={() => {}} />);
    expect(screen.getByRole('link', { name: /Calendar/i })).toHaveAttribute('href', '/calendar');
    expect(screen.getByRole('link', { name: /People/i })).toHaveAttribute('href', '/people');
    expect(screen.getByRole('link', { name: /Settings/i })).toHaveAttribute('href', '/settings');
  });

  it('closes on backdrop click', async () => {
    const onClose = vi.fn();
    render(<MoreSheet open onClose={onClose} />);
    await userEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const onClose = vi.fn();
    render(<MoreSheet open onClose={onClose} />);
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
