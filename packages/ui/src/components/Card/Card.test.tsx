import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Contents</Card>);
    expect(screen.getByText('Contents')).toBeInTheDocument();
  });

  it('renders as the requested element', () => {
    render(<Card as="article">Article body</Card>);
    expect(screen.getByText('Article body').tagName).toBe('ARTICLE');
  });
});
