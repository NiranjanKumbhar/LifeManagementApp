import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { UserChip } from './UserChip';

const alex = { id: 'u1', displayName: 'Alex Rivera', avatarUrl: null };

describe('UserChip', () => {
  it('shows the first name', () => {
    render(<UserChip user={alex} />);
    expect(screen.getByText('Alex')).toBeInTheDocument();
  });

  it('renders the optional label', () => {
    render(<UserChip user={alex} label="Added by" />);
    expect(screen.getByText('Added by')).toBeInTheDocument();
  });

  it('renders a dash placeholder when there is no user', () => {
    render(<UserChip user={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
