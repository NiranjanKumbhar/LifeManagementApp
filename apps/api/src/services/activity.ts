import { activityEvents, type ActivityAction } from '../db/schema';
import type { Database } from '../db/client';

/** A Drizzle transaction handle (same query surface as the base client). */
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface ActivityInput {
  workspaceId: string;
  userId: string;
  entityType: string;
  entityId: string;
  action: ActivityAction;
  changes?: Record<string, { old: unknown; new: unknown }> | null;
}

/** Append an audit event. Call inside the same transaction as the mutation. */
export async function logActivity(tx: Tx, input: ActivityInput): Promise<void> {
  await tx.insert(activityEvents).values({
    workspaceId: input.workspaceId,
    userId: input.userId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    changes: input.changes ?? null,
  });
}
