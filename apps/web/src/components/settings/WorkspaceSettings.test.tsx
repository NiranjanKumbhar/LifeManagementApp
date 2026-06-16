import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ToastProvider } from '@lifesync/ui';
import { WorkspaceSettings } from './WorkspaceSettings';

const revokeSpy = vi.fn();
const createInviteMutate = vi.fn();
const invalidateSpy = vi.fn();
const membersInvalidateSpy = vi.fn();
const mineInvalidateSpy = vi.fn();
const changeRoleSpy = vi.fn();
const removeMemberSpy = vi.fn();
const leaveSpy = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

// Mutable workspace count so tests can simulate "this is my only workspace".
const mockState = vi.hoisted(() => ({
  workspaces: [{ workspace: { id: 'ws-1' } }, { workspace: { id: 'ws-2' } }] as unknown[],
}));
vi.mock('@/lib/workspace-context', () => ({
  useWorkspace: () => ({ workspaces: mockState.workspaces, setActiveWorkspace: vi.fn() }),
}));

vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      workspace: {
        listInvites: { invalidate: invalidateSpy },
        members: { invalidate: membersInvalidateSpy },
        mine: { invalidate: mineInvalidateSpy },
      },
    }),
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
      changeRole: {
        useMutation: (o: { onSuccess?: () => void }) => ({
          mutate: (input: unknown) => {
            changeRoleSpy(input);
            o.onSuccess?.();
          },
          isPending: false,
        }),
      },
      removeMember: {
        useMutation: (o: { onSuccess?: () => void }) => ({
          mutate: (input: unknown) => {
            removeMemberSpy(input);
            o.onSuccess?.();
          },
          isPending: false,
        }),
      },
      leave: {
        useMutation: (o: { onSuccess?: () => void }) => ({
          mutate: (input: unknown) => {
            leaveSpy(input);
            o.onSuccess?.();
          },
          isPending: false,
        }),
      },
    },
  },
}));

const workspace = { id: 'ws-1', name: 'Home' };
const members = [
  { userId: 'u1', role: 'owner', user: { id: 'u1', displayName: 'Alex', email: 'a@x.com', avatarUrl: null } },
  { userId: 'u2', role: 'member', user: { id: 'u2', displayName: 'Jordan', email: 'j@x.com', avatarUrl: null } },
];

function renderWithToast(node: React.ReactElement) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

describe('WorkspaceSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    // Default: user is in more than one workspace (leaving is not the "last one").
    mockState.workspaces = [{ workspace: { id: 'ws-1' } }, { workspace: { id: 'ws-2' } }];
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
    expect(screen.getByText('Home')).toBeInTheDocument();
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

  it('lets an owner change another member role and remove them', () => {
    renderWithToast(
      <WorkspaceSettings
        workspace={workspace as never}
        members={members as never}
        currentUserId="u1"
        role="owner"
      />,
    );
    const jordanRow = screen.getByText('Jordan').closest('li')!;
    const makeOwnerButton = within(jordanRow).getByRole('button', { name: /Make owner/i });
    const removeButton = within(jordanRow).getByRole('button', { name: /Remove/i });

    fireEvent.click(makeOwnerButton);
    expect(changeRoleSpy).toHaveBeenCalledWith({ workspaceId: 'ws-1', targetUserId: 'u2', role: 'owner' });

    fireEvent.click(removeButton);
    expect(removeMemberSpy).toHaveBeenCalledWith({ workspaceId: 'ws-1', targetUserId: 'u2' });
  });

  it('hides manage controls for the sole owner and disables Leave for them', () => {
    renderWithToast(
      <WorkspaceSettings
        workspace={workspace as never}
        members={members as never}
        currentUserId="u1"
        role="owner"
      />,
    );
    const alexRow = screen.getByText(/Alex/).closest('li')!;
    expect(within(alexRow).queryByRole('button', { name: /Make member/i })).not.toBeInTheDocument();
    expect(within(alexRow).queryByRole('button', { name: /Remove/i })).not.toBeInTheDocument();

    const leaveButton = screen.getByRole('button', { name: /Leave workspace/i });
    expect(leaveButton).toBeDisabled();
  });

  it('shows no manage controls for a member view but allows Leave', () => {
    renderWithToast(
      <WorkspaceSettings
        workspace={workspace as never}
        members={members as never}
        currentUserId="u2"
        role="member"
      />,
    );
    expect(screen.queryByRole('button', { name: /Make owner/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Make member/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Remove/i })).not.toBeInTheDocument();

    const leaveButton = screen.getByRole('button', { name: /Leave workspace/i });
    expect(leaveButton).toBeEnabled();
    fireEvent.click(leaveButton);
    expect(leaveSpy).toHaveBeenCalledWith({ workspaceId: 'ws-1' });
  });

  it('warns and confirms before leaving your only workspace', () => {
    mockState.workspaces = [{ workspace: { id: 'ws-1' } }];
    renderWithToast(
      <WorkspaceSettings
        workspace={workspace as never}
        members={members as never}
        currentUserId="u2"
        role="member"
      />,
    );
    // First click → no leave yet, shows the confirm.
    fireEvent.click(screen.getByRole('button', { name: /Leave workspace/i }));
    expect(leaveSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/only workspace/i)).toBeInTheDocument();

    // Confirm → leaves.
    fireEvent.click(screen.getByRole('button', { name: /Leave anyway/i }));
    expect(leaveSpy).toHaveBeenCalledWith({ workspaceId: 'ws-1' });
  });
});
