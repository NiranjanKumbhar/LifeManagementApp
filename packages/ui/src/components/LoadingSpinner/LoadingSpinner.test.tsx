import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingSpinner } from './LoadingSpinner';

describe('LoadingSpinner', () => {
  it('exposes a status role with an accessible label', () => {
    render(<LoadingSpinner label="Loading dashboard" />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading dashboard');
  });
});
