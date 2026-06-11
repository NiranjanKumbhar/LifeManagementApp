import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardBlock } from './DashboardBlock';

describe('DashboardBlock', () => {
  it('renders the title, count and children', () => {
    render(
      <DashboardBlock title="Needs action today" icon={<svg />} count={3}>
        <p>Block content</p>
      </DashboardBlock>,
    );
    expect(screen.getByRole('heading', { name: 'Needs action today' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Block content')).toBeInTheDocument();
  });

  it('hides the count when zero', () => {
    render(
      <DashboardBlock title="Empty" icon={<svg />} count={0}>
        <p>none</p>
      </DashboardBlock>,
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
