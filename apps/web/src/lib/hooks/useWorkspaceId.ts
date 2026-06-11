/**
 * The active workspace id.
 *
 * Temporary single-workspace assumption sourced from an env var
 * (the seeded "Our Home" workspace). Replace with real workspace
 * selection once a `workspace.list` / current-workspace endpoint exists.
 */
export function useWorkspaceId(): string | null {
  return process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID ?? null;
}
