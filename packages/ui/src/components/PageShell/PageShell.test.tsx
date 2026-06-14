import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageShell } from './PageShell';

describe('PageShell', () => {
  it('renders its children', () => {
    render(<PageShell><p>hello</p></PageShell>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
