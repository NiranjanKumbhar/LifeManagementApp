import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from './SegmentedControl';

const options = [
  { value: 'shopping', label: 'Shopping list' },
  { value: 'inventory', label: 'Inventory' },
];

describe('SegmentedControl', () => {
  it('renders a tablist with the options', () => {
    render(<SegmentedControl options={options} value="shopping" onChange={() => {}} ariaLabel="View" />);
    expect(screen.getByRole('tablist', { name: 'View' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Shopping list', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Inventory', selected: false })).toBeInTheDocument();
  });

  it('calls onChange when a segment is clicked', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={options} value="shopping" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Inventory' }));
    expect(onChange).toHaveBeenCalledWith('inventory');
  });

  it('moves selection with the arrow keys', async () => {
    const onChange = vi.fn();
    render(<SegmentedControl options={options} value="shopping" onChange={onChange} />);
    screen.getByRole('tab', { name: 'Shopping list' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('inventory');
  });
});
