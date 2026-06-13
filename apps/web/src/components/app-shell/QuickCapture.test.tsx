import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { captureMutate, addMutate, taskMutate, projectMutate } = vi.hoisted(() => ({
  captureMutate: vi.fn(),
  addMutate: vi.fn(),
  taskMutate: vi.fn(),
  projectMutate: vi.fn(),
}));

vi.mock('@/lib/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/lib/trpc', () => {
  const mut = (spy: (v: unknown) => void, result?: unknown) => ({
    useMutation: (opts: { onSuccess?: (d: unknown, v: unknown) => void; onError?: () => void }) => ({
      mutate: (vars: unknown) => {
        spy(vars);
        opts?.onSuccess?.(result, vars);
      },
      isPending: false,
    }),
  });
  return {
    trpc: {
      useUtils: () => ({
        inbox: { list: { invalidate: vi.fn() } },
        household: { list: { invalidate: vi.fn() } },
        project: { list: { invalidate: vi.fn() }, get: { invalidate: vi.fn() } },
      }),
      project: {
        list: {
          useQuery: () => ({
            data: [
              { id: 'p1', title: 'Japan trip' },
              { id: 'p2', title: "Mum's 60th" },
            ],
          }),
        },
        create: mut(projectMutate, { id: 'p3', title: 'New thing' }),
      },
      inbox: { capture: mut(captureMutate) },
      household: { add: mut(addMutate) },
      task: { create: mut(taskMutate) },
    },
  };
});

import { QuickCapture } from './QuickCapture';

beforeEach(() => {
  window.localStorage.clear();
  captureMutate.mockClear();
  addMutate.mockClear();
  taskMutate.mockClear();
  projectMutate.mockClear();
});

async function openPicker() {
  await userEvent.click(screen.getByRole('button', { name: /To:/ }));
}

describe('QuickCapture', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<QuickCapture open={false} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('defaults to Inbox: captures the note and closes', async () => {
    const onClose = vi.fn();
    render(<QuickCapture open onClose={onClose} />);
    await userEvent.type(screen.getByLabelText("What's on your mind?"), 'Buy milk{Enter}');
    expect(captureMutate).toHaveBeenCalledWith({ workspaceId: 'ws-1', content: 'Buy milk' });
    expect(onClose).toHaveBeenCalled();
  });

  it('routes to a chosen project via task.create and stays open', async () => {
    const onClose = vi.fn();
    render(<QuickCapture open onClose={onClose} />);
    await openPicker();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Japan trip' }));
    const input = screen.getByLabelText("What's on your mind?");
    await userEvent.type(input, 'book the ryokan{Enter}');
    expect(taskMutate).toHaveBeenCalledWith({ projectId: 'p1', title: 'book the ryokan' });
    expect(onClose).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
  });

  it('creates a new project and files the captured text as its first task', async () => {
    render(<QuickCapture open onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText("What's on your mind?"), 'call the caterer');
    await openPicker();
    await userEvent.click(screen.getByRole('menuitem', { name: '+ New project…' }));
    await userEvent.type(screen.getByLabelText(/Name/), 'Party');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(projectMutate).toHaveBeenCalledWith({ workspaceId: 'ws-1', type: 'general', title: 'Party' });
    expect(taskMutate).toHaveBeenCalledWith({ projectId: 'p3', title: 'call the caterer' });
  });

  it('shows the shopping placeholder when Shopping list is chosen', async () => {
    render(<QuickCapture open onClose={() => {}} />);
    await openPicker();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Shopping list' }));
    expect(screen.getByPlaceholderText('Add to shopping list…')).toBeInTheDocument();
  });
});
