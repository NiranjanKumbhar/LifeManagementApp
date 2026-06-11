import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DatesList } from './DatesList';

describe('DatesList', () => {
  it('renders people with a birthday label', () => {
    render(
      <DatesList
        items={[
          { id: '1', name: 'Susan', relationship: 'parent', birthday: '2026-07-01', anniversary: null },
        ]}
      />,
    );
    expect(screen.getByText('Susan')).toBeInTheDocument();
    expect(screen.getByText(/Birthday/)).toBeInTheDocument();
  });

  it('shows an empty state with no upcoming dates', () => {
    render(<DatesList items={[]} />);
    expect(screen.getByText('No dates soon')).toBeInTheDocument();
  });
});
