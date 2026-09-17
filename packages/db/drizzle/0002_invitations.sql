-- =====================================================================
-- Migration 0002: invitations table
-- Written manually (see note on migration 0000). Replaces the in-memory
-- Map that previously backed apps/api/src/store.ts — invitations were
-- lost on every API restart.
-- =====================================================================

CREATE TABLE "invitations" (
  "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"       UUID NOT NULL REFERENCES "organizations"("id"),
  "email"        TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "role"         "role" NOT NULL,
  "token"        TEXT NOT NULL UNIQUE,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON "invitations" TO athar_app;
