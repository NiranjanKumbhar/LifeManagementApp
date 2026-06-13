import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { captureMutate, addMutate } = vi.hoisted(() => ({
  captureMutate: vi.fn(),
  addMutate: vi.fn(),
}));

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({
      inbox: { list: { invalidate: vi.fn() } },
      household: { list: { invalidate: vi.fn() } },
    }),
    inbox: {
      capture: {
        useMutation: (opts: { onSuccess?: () => void }) => ({
          mutate: (vars: unknown) => {
            captureMutate(vars);
            opts?.onSuccess?.();
          },
          isPending: false,
          isError: false,
        }),
      },
    },
    household: {
      add: {
        useMutation: (opts: { onSuccess?: () => void }) => ({
          mutate: (vars: unknown) => {
            addMutate(vars);
            opts?.onSuccess?.();
          },
          isPending: false,
          isError: false,
        }),
      },
    },
  },
}));

import { QuickCapture } from './QuickCapture';

beforeEach(() => {
  window.localStorage.clear();
  captureMutate.mockClear();
  addMutate.mockClear();
});

describe('QuickCapture', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<QuickCapture open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('focuses the input when opened', () => {
    render(<QuickCapture open onClose={() => {}} />);
    expect(screen.getByLabelText("What's on your mind?")).toHaveFocus();
  });

  it('defaults to Inbox: captures the note and closes', async () => {
    const onClose = vi.fn();
    render(<QuickCapture open onClose={onClose} />);
    await userEvent.type(screen.getByLabelText("What's on your mind?"), 'Buy milk{Enter}');
    expect(captureMutate).toHaveBeenCalledWith({ workspaceId: 'ws-1', content: 'Buy milk' });
    expect(addMutate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('routes to the shopping list, stays open, and clears the input', async () => {
    const onClose = vi.fn();
    render(<QuickCapture open onClose={onClose} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Shopping list' }));
    const input = screen.getByLabelText("What's on your mind?");
    await userEvent.type(input, 'milk{Enter}');
    expect(addMutate).toHaveBeenCalledWith({ workspaceId: 'ws-1', name: 'milk', status: 'on_list' });
    expect(captureMutate).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
  });

  it('supports burst add of multiple shopping items', async () => {
    render(<QuickCapture open onClose={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Shopping list' }));
    const input = screen.getByLabelText("What's on your mind?");
    await userEvent.type(input, 'milk{Enter}');
    await userEvent.type(input, 'eggs{Enter}');
    expect(addMutate).toHaveBeenCalledTimes(2);
    expect(addMutate).toHaveBeenLastCalledWith({ workspaceId: 'ws-1', name: 'eggs', status: 'on_list' });
  });

  it('shows the shopping placeholder when the destination is Shopping list', async () => {
    render(<QuickCapture open onClose={() => {}} />);
    await userEvent.click(screen.getByRole('tab', { name: 'Shopping list' }));
    expect(screen.getByPlaceholderText('Add to shopping list…')).toBeInTheDocument();
  });
});
