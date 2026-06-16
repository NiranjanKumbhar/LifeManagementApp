import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastProvider } from '@lifesync/ui';
import { WorkspaceSettings } from './WorkspaceSettings';

const revokeSpy = vi.fn();
const createInviteMutate = vi.fn();
const invalidateSpy = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ workspace: { listInvites: { invalidate: invalidateSpy } } }),
    workspace: {
      createInvite: {
        useMutation: (o: { onSuccess?: (res: { invite: { id: string }; joinPath: string }) => void }) => ({
          mutate: (input: unknown) => {
            createInviteMutate(input);
            o.onSuccess?.({ invite: { id: 'i1' }, joinPath: '/join/tok' });
          },
          isPending: false,
        }),
      },
      listInvites: {
        useQuery: () => ({
          data: [{ id: 'i1', email: null, status: 'pending', createdAt: new Date().toISOString() }],
        }),
      },
      revokeInvite: {
        useMutation: (o: { onSuccess?: () => void }) => ({
          mutate: (input: unknown) => {
            revokeSpy(input);
            o.onSuccess?.();
          },
          isPending: false,
        }),
      },
    },
  },
}));

const workspace = { id: 'ws-1', name: 'Our Home' };
const members = [
  { role: 'owner', user: { id: 'u1', displayName: 'Alex', email: 'a@b.com', avatarUrl: null } },
  { role: 'member', user: { id: 'u2', displayName: 'Jordan', email: 'j@b.com', avatarUrl: null } },
];

function renderWithToast(node: React.ReactElement) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

describe('WorkspaceSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('renders the workspace name and members', () => {
    renderWithToast(
      <WorkspaceSettings
        workspace={workspace as never}
        members={members as never}
        currentUserId="u1"
        role="owner"
      />,
    );
    expect(screen.getByText('Our Home')).toBeInTheDocument();
    expect(screen.getByText(/Alex/)).toBeInTheDocument();
    expect(screen.getByText('Jordan')).toBeInTheDocument();
  });

  it('shows an enabled Invite button for owners that creates an invite and copies the link', async () => {
    renderWithToast(
      <WorkspaceSettings
        workspace={workspace as never}
        members={members as never}
        currentUserId="u1"
        role="owner"
      />,
    );
    const inviteButton = screen.getByRole('button', { name: /Invite/i });
    expect(inviteButton).toBeEnabled();

    fireEvent.click(inviteButton);

    expect(createInviteMutate).toHaveBeenCalledWith({ workspaceId: 'ws-1' });
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/join/tok'),
      );
    });
  });

  it('renders pending invites with a Revoke button that calls the revoke mutation', () => {
    renderWithToast(
      <WorkspaceSettings
        workspace={workspace as never}
        members={members as never}
        currentUserId="u1"
        role="owner"
      />,
    );
    const revokeButton = screen.getByRole('button', { name: /Revoke/i });
    fireEvent.click(revokeButton);
    expect(revokeSpy).toHaveBeenCalledWith({ id: 'i1' });
  });

  it('does not render invite controls for non-owners', () => {
    renderWithToast(
      <WorkspaceSettings
        workspace={workspace as never}
        members={members as never}
        currentUserId="u2"
        role="member"
      />,
    );
    expect(screen.queryByRole('button', { name: /Invite/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Revoke/i })).not.toBeInTheDocument();
  });
});
