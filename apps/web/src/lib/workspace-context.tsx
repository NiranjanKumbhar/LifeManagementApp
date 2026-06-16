'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { trpc } from '@/lib/trpc';

const STORAGE_KEY = 'ls-active-workspace';

interface MyWorkspace {
  workspace: { id: string; name: string };
  role: 'owner' | 'member';
}
interface WorkspaceContextValue {
  workspaceId: string | null;
  workspaces: MyWorkspace[];
  role: 'owner' | 'member' | null;
  setActiveWorkspace: (id: string) => void;
  isLoading: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const query = trpc.workspace.mine.useQuery();
  const workspaces = (query.data ?? []) as MyWorkspace[];
  const [chosen, setChosen] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem(STORAGE_KEY),
  );

  const valid = workspaces.find((w) => w.workspace.id === chosen);
  const workspaceId = (valid?.workspace.id ?? workspaces[0]?.workspace.id) ?? null;
  const role = workspaces.find((w) => w.workspace.id === workspaceId)?.role ?? null;

  const setActiveWorkspace = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setChosen(id);
  }, []);

  const value = useMemo(
    () => ({ workspaceId, workspaces, role, setActiveWorkspace, isLoading: query.isLoading }),
    [workspaceId, workspaces, role, setActiveWorkspace, query.isLoading],
  );
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within a WorkspaceProvider');
  return ctx;
}
