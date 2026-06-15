import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@clerk/nextjs', () => ({ UserButton: () => <div data-testid="user-button" /> }));

const useMeMock = vi.fn();
vi.mock('@/lib/trpc', () => ({ trpc: { user: { me: { useQuery: () => useMeMock() } } } }));

import { AccountControl } from './AccountControl';

describe('AccountControl', () => {
  it('shows the user display name and the account button', () => {
    useMeMock.mockReturnValue({ data: { displayName: 'Alex Rivera' } });
    render(<AccountControl />);
    expect(screen.getByText('Alex Rivera')).toBeInTheDocument();
    expect(screen.getByTestId('user-button')).toBeInTheDocument();
  });

  it('falls back to "Your account" when there is no data', () => {
    useMeMock.mockReturnValue({ data: undefined });
    render(<AccountControl />);
    expect(screen.getByText('Your account')).toBeInTheDocument();
  });
});
