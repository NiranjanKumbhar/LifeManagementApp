import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the title as an h1', () => {
    render(<PageHeader title="Projects" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
  });

  it('renders subtitle, back link, and actions when provided', () => {
    render(
      <PageHeader
        title="Mum"
        subtitle="Mother"
        backHref="/people"
        actions={<button type="button">Edit</button>}
      />,
    );
    expect(screen.getByText('Mother')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /people/i })).toHaveAttribute('href', '/people');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});
