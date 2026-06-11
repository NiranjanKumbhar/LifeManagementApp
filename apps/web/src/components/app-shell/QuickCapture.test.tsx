import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { captureMutate } = vi.hoisted(() => ({ captureMutate: vi.fn() }));

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ inbox: { list: { invalidate: vi.fn() } } }),
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
  },
}));

import { QuickCapture } from './QuickCapture';

describe('QuickCapture', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<QuickCapture open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('focuses the input when opened', () => {
    render(<QuickCapture open onClose={() => {}} />);
    expect(screen.getByLabelText("What's on your mind?")).toHaveFocus();
  });

  it('captures the note to the inbox and closes', async () => {
    const onClose = vi.fn();
    render(<QuickCapture open onClose={onClose} />);
    await userEvent.type(screen.getByLabelText("What's on your mind?"), 'Buy milk{Enter}');
    expect(captureMutate).toHaveBeenCalledWith({ workspaceId: 'ws-1', content: 'Buy milk' });
    expect(onClose).toHaveBeenCalled();
  });
});
