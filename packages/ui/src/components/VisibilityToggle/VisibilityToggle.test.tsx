import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VisibilityToggle } from './VisibilityToggle';

describe('VisibilityToggle', () => {
  it('shows the current value and switches', async () => {
    const onChange = vi.fn();
    render(<VisibilityToggle value="shared" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /private/i }));
    expect(onChange).toHaveBeenCalledWith('private');
  });
});
