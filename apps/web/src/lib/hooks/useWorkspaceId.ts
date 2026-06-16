'use client';

import { useWorkspace } from '@/lib/workspace-context';

/**
 * The active workspace id, from WorkspaceProvider. Returns null while loading
 * or when the user has no workspace. Signature unchanged for existing callers.
 */
export function useWorkspaceId(): string | null {
  return useWorkspace().workspaceId;
}
