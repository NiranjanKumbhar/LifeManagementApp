import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusPillMenu } from './StatusPillMenu';

describe('StatusPillMenu', () => {
  it('shows the current status label', () => {
    render(<StatusPillMenu status="out" onSelect={() => {}} />);
    expect(screen.getByRole('button', { name: /out/i })).toBeInTheDocument();
  });

  it('opens a menu and reports the chosen status', async () => {
    const onSelect = vi.fn();
    render(<StatusPillMenu status="out" onSelect={onSelect} />);
    await userEvent.click(screen.getByRole('button', { name: /out/i }));
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Stocked' }));
    expect(onSelect).toHaveBeenCalledWith('stocked');
  });

  it('closes the menu when Escape is pressed', async () => {
    render(<StatusPillMenu status="out" onSelect={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /out/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes the menu when clicking outside', async () => {
    render(
      <div>
        <StatusPillMenu status="out" onSelect={() => {}} />
        <button type="button">outside</button>
      </div>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^out$/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
