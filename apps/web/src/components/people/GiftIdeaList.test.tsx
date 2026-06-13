import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GiftIdeaList } from './GiftIdeaList';

const ideas = [
  { idea: 'Headphones', budget: 120, purchased: false },
  { idea: 'Spa day', purchased: true },
];

describe('GiftIdeaList', () => {
  it('toggles purchased and reports the updated array', async () => {
    const onChange = vi.fn();
    render(<GiftIdeaList giftIdeas={ideas} onChange={onChange} />);
    await userEvent.click(screen.getByRole('checkbox', { name: /Headphones/ }));
    expect(onChange).toHaveBeenCalledWith([
      { idea: 'Headphones', budget: 120, purchased: true },
      { idea: 'Spa day', purchased: true },
    ]);
  });

  it('removes an idea', async () => {
    const onChange = vi.fn();
    render(<GiftIdeaList giftIdeas={ideas} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /remove Spa day/i }));
    expect(onChange).toHaveBeenCalledWith([{ idea: 'Headphones', budget: 120, purchased: false }]);
  });

  it('adds a new idea', async () => {
    const onChange = vi.fn();
    render(<GiftIdeaList giftIdeas={[]} onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Gift idea'), 'Book set');
    await userEvent.click(screen.getByRole('button', { name: 'Add gift idea' }));
    expect(onChange).toHaveBeenCalledWith([{ idea: 'Book set', purchased: false }]);
  });
});
