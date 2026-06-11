import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from './Avatar';

describe('Avatar', () => {
  it('derives initials from a full name', () => {
    render(<Avatar name="Alex Rivera" />);
    expect(screen.getByText('AR')).toBeInTheDocument();
  });

  it('is labelled by the person name', () => {
    render(<Avatar name="Jordan" />);
    expect(screen.getByRole('img', { name: 'Jordan' })).toBeInTheDocument();
  });
});
