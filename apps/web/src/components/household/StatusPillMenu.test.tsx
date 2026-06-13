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
});
