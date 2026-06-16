import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@/lib/trpc', () => ({
  trpc: { workspace: { mine: { useQuery: () => ({ data: [
    { workspace: { id: 'w1', name: 'A' }, role: 'owner' },
    { workspace: { id: 'w2', name: 'B' }, role: 'member' },
  ], isLoading: false }) } } },
}));

import { WorkspaceProvider, useWorkspace } from './workspace-context';

const wrapper = ({ children }: { children: ReactNode }) => <WorkspaceProvider>{children}</WorkspaceProvider>;

describe('workspace-context', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to the first workspace', () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    expect(result.current.workspaceId).toBe('w1');
    expect(result.current.workspaces).toHaveLength(2);
  });

  it('switches and persists', () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    act(() => result.current.setActiveWorkspace('w2'));
    expect(result.current.workspaceId).toBe('w2');
    expect(localStorage.getItem('ls-active-workspace')).toBe('w2');
  });

  it('honors a persisted choice', () => {
    localStorage.setItem('ls-active-workspace', 'w2');
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    expect(result.current.workspaceId).toBe('w2');
  });
});
