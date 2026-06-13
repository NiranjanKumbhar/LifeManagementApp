import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickAddBar } from './QuickAddBar';

describe('QuickAddBar', () => {
  it('submits the trimmed name on Enter and clears the field', async () => {
    const onAdd = vi.fn();
    render(<QuickAddBar onAdd={onAdd} />);
    const input = screen.getByRole('textbox', { name: /add item/i });
    await userEvent.type(input, '  Milk  {Enter}');
    expect(onAdd).toHaveBeenCalledWith('Milk');
    expect(input).toHaveValue('');
  });

  it('does not submit an empty name', async () => {
    const onAdd = vi.fn();
    render(<QuickAddBar onAdd={onAdd} />);
    await userEvent.type(screen.getByRole('textbox', { name: /add item/i }), '   {Enter}');
    expect(onAdd).not.toHaveBeenCalled();
  });
});
