import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StockList } from './StockList';

describe('StockList', () => {
  it('labels out-of-stock and low items', () => {
    render(
      <StockList
        items={[
          { id: '1', name: 'Milk', status: 'low' },
          { id: '2', name: 'Bread', status: 'out' },
        ]}
      />,
    );
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Out')).toBeInTheDocument();
  });

  it('shows a stocked empty state', () => {
    render(<StockList items={[]} />);
    expect(screen.getByText('Fully stocked')).toBeInTheDocument();
  });
});
