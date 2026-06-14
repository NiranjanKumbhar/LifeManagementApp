import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkspaceSettings } from './WorkspaceSettings';

const workspace = { id: 'ws-1', name: 'Our Home' };
const members = [
  { role: 'owner', user: { id: 'u1', displayName: 'Alex', email: 'a@b.com', avatarUrl: null } },
  { role: 'member', user: { id: 'u2', displayName: 'Jordan', email: 'j@b.com', avatarUrl: null } },
];

describe('WorkspaceSettings', () => {
  it('renders the workspace name and members', () => {
    render(
      <WorkspaceSettings workspace={workspace as never} members={members as never} currentUserId="u1" />,
    );
    expect(screen.getByText('Our Home')).toBeInTheDocument();
    expect(screen.getByText(/Alex/)).toBeInTheDocument();
    expect(screen.getByText('Jordan')).toBeInTheDocument();
  });

  it('disables the invite button', () => {
    render(
      <WorkspaceSettings workspace={workspace as never} members={members as never} currentUserId="u1" />,
    );
    expect(screen.getByRole('button', { name: /Invite/i })).toBeDisabled();
  });
});
