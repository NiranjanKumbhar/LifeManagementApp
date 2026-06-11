import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PartnerBadge } from './PartnerBadge';

describe('PartnerBadge', () => {
  it('shows "Shared" for shared ownership', () => {
    render(<PartnerBadge ownership="shared" />);
    expect(screen.getByText('Shared')).toBeInTheDocument();
  });

  it('uses the provided name for partner-owned items', () => {
    render(<PartnerBadge ownership="partner" name="Jordan" />);
    expect(screen.getByText('Jordan')).toBeInTheDocument();
  });
});
