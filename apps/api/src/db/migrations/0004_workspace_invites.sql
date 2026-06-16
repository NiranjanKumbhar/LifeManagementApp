CREATE TABLE "workspace_invites" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "token"        text NOT NULL UNIQUE,
  "email"        text,
  "role"         text NOT NULL DEFAULT 'member' CHECK ("role" IN ('owner','member')),
  "status"       text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending','accepted','revoked','expired')),
  "invited_by"   uuid NOT NULL REFERENCES "users"("id"),
  "expires_at"   timestamptz NOT NULL,
  "accepted_by"  uuid REFERENCES "users"("id"),
  "accepted_at"  timestamptz,
  "created_at"   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "idx_workspace_invites_workspace" ON "workspace_invites" ("workspace_id");
