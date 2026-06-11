import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the title and description', () => {
    render(<EmptyState title="All clear" description="Nothing needs attention." />);
    expect(screen.getByText('All clear')).toBeInTheDocument();
    expect(screen.getByText('Nothing needs attention.')).toBeInTheDocument();
  });
});
