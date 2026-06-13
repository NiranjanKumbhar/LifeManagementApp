/**
 * Deterministic, stable ordering for tasks.
 *
 * Tasks are created with `sortOrder` defaulting to 0, so most tasks tie on it.
 * Ordering by `sortOrder` alone leaves tied rows in non-deterministic database
 * order, which reshuffles after any UPDATE (e.g. completing a task) — making the
 * task list appear to jump around and, with same-named tasks, look as though the
 * wrong one was toggled. The `createdAt` then `id` tiebreakers make the order
 * fully deterministic regardless of how the database returns tied rows.
 */
export function compareTasks(
  a: { sortOrder: number; createdAt: Date; id: string },
  b: { sortOrder: number; createdAt: Date; id: string },
): number {
  return (
    a.sortOrder - b.sortOrder ||
    a.createdAt.getTime() - b.createdAt.getTime() ||
    a.id.localeCompare(b.id)
  );
}
