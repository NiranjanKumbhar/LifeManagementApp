import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const setActiveWorkspace = vi.fn();
vi.mock('@/lib/workspace-context', () => ({
  useWorkspace: () => ({
    workspaceId: 'w1',
    workspaces: [
      { workspace: { id: 'w1', name: 'Home' }, role: 'owner' },
      { workspace: { id: 'w2', name: 'Beach House' }, role: 'member' },
    ],
    role: 'owner',
    setActiveWorkspace,
    isLoading: false,
  }),
}));

import { WorkspaceSwitcher } from './WorkspaceSwitcher';

describe('WorkspaceSwitcher', () => {
  it('shows the active workspace and switches', async () => {
    render(<WorkspaceSwitcher />);
    await userEvent.selectOptions(screen.getByLabelText(/workspace/i), 'w2');
    expect(setActiveWorkspace).toHaveBeenCalledWith('w2');
  });
});
