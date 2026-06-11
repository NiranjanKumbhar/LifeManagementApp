import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DeadlineList } from './DeadlineList';

describe('DeadlineList', () => {
  it('renders each item title', () => {
    render(
      <DeadlineList
        items={[
          { id: '1', title: 'Renew permit', dueDate: null },
          { id: '2', title: 'Buy gift', dueDate: null },
        ]}
        emptyTitle="Nothing here"
      />,
    );
    expect(screen.getByText('Renew permit')).toBeInTheDocument();
    expect(screen.getByText('Buy gift')).toBeInTheDocument();
  });

  it('shows the empty state when there are no items', () => {
    render(<DeadlineList items={[]} emptyTitle="Nothing due today" />);
    expect(screen.getByText('Nothing due today')).toBeInTheDocument();
  });
});
