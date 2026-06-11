import type { Database } from '../../db/client';
import type { users, workspaces } from '../../db/schema';
import { insertWorkspace } from '../factories/workspace.factory';
import { addMember, insertUser } from '../factories/user.factory';

type WorkspaceRow = typeof workspaces.$inferSelect;
type UserRow = typeof users.$inferSelect;

export interface SeededCouple {
  workspace: WorkspaceRow;
  alex: UserRow; // owner
  jordan: UserRow; // partner / member
}

/**
 * The canonical two-partner setup: one workspace with Alex (owner) and
 * Jordan (member). The backbone for visibility and partner tests.
 */
export async function seedCouple(db: Database): Promise<SeededCouple> {
  const workspace = await insertWorkspace(db);
  const alex = await insertUser(db, { displayName: 'Alex' });
  const jordan = await insertUser(db, { displayName: 'Jordan' });
  await addMember(db, workspace.id, alex.id, 'owner');
  await addMember(db, workspace.id, jordan.id, 'member');
  return { workspace, alex, jordan };
}
