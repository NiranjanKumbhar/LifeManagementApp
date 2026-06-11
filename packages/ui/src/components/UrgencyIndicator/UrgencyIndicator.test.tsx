import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UrgencyIndicator } from './UrgencyIndicator';

describe('UrgencyIndicator', () => {
  it('shows the level label by default', () => {
    render(<UrgencyIndicator level="overdue" />);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('exposes an accessible label when the text is hidden', () => {
    render(<UrgencyIndicator level="soon" showLabel={false} />);
    expect(screen.getByRole('img', { name: 'Soon' })).toBeInTheDocument();
  });
});
