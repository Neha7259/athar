-- =====================================================================
-- Migration 0003: row-level security (DB-level tenant isolation)
-- Written manually (see note on migration 0000).
--
-- Until now, multi-tenancy was enforced only by app-code `WHERE org_id =
-- ...` filters in apps/api/src/app.ts — a single missed filter on a new
-- route would leak data across organizations. These policies make the
-- database itself refuse cross-tenant reads/writes for the `athar_app`
-- role (it does not own these tables, so RLS applies to it automatically).
--
-- Policies read the `app.current_org_id` session setting, which the API
-- sets with `set_config('app.current_org_id', <orgId>, true)` inside a
-- transaction (see apps/api/src/database.ts withOrgScope). The `true`
-- (is_local) flag scopes it to that one transaction; `current_setting(...,
-- true)` returns NULL when unset, and NULL never equals any org_id, so a
-- query run without a scope sees zero rows (fail closed) rather than
-- erroring or leaking everything.
--
-- NOT row-level secured, deliberately: `organizations`, `users`,
-- `memberships` — login/register must resolve a user's org before an org
-- context exists, and `emission_factors` — global reference data, not
-- tenant data. `dq_flags` is also left out: its target is polymorphic
-- (target_type/target_id can point at several tables) and nothing writes
-- to it yet (the /dq/preview route is compute-only, no persistence).
-- =====================================================================

ALTER TABLE "facilities" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facilities_org_isolation" ON "facilities" FOR ALL USING (
  "org_id" = current_setting('app.current_org_id', true)::uuid
) WITH CHECK (
  "org_id" = current_setting('app.current_org_id', true)::uuid
);

ALTER TABLE "evidence_documents" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_documents_org_isolation" ON "evidence_documents" FOR ALL USING (
  "org_id" = current_setting('app.current_org_id', true)::uuid
) WITH CHECK (
  "org_id" = current_setting('app.current_org_id', true)::uuid
);

ALTER TABLE "invitations" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invitations_org_isolation" ON "invitations" FOR ALL USING (
  "org_id" = current_setting('app.current_org_id', true)::uuid
) WITH CHECK (
  "org_id" = current_setting('app.current_org_id', true)::uuid
);

ALTER TABLE "exports" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exports_org_isolation" ON "exports" FOR ALL USING (
  "org_id" = current_setting('app.current_org_id', true)::uuid
) WITH CHECK (
  "org_id" = current_setting('app.current_org_id', true)::uuid
);

ALTER TABLE "emission_sources" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "emission_sources_org_isolation" ON "emission_sources" FOR ALL USING (
  EXISTS (
    SELECT 1 FROM "facilities" f
    WHERE f."id" = "emission_sources"."facility_id"
      AND f."org_id" = current_setting('app.current_org_id', true)::uuid
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM "facilities" f
    WHERE f."id" = "emission_sources"."facility_id"
      AND f."org_id" = current_setting('app.current_org_id', true)::uuid
  )
);

ALTER TABLE "reduction_measures" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reduction_measures_org_isolation" ON "reduction_measures" FOR ALL USING (
  EXISTS (
    SELECT 1 FROM "facilities" f
    WHERE f."id" = "reduction_measures"."facility_id"
      AND f."org_id" = current_setting('app.current_org_id', true)::uuid
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM "facilities" f
    WHERE f."id" = "reduction_measures"."facility_id"
      AND f."org_id" = current_setting('app.current_org_id', true)::uuid
  )
);

ALTER TABLE "extractions" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extractions_org_isolation" ON "extractions" FOR ALL USING (
  EXISTS (
    SELECT 1 FROM "evidence_documents" ed
    WHERE ed."id" = "extractions"."document_id"
      AND ed."org_id" = current_setting('app.current_org_id', true)::uuid
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM "evidence_documents" ed
    WHERE ed."id" = "extractions"."document_id"
      AND ed."org_id" = current_setting('app.current_org_id', true)::uuid
  )
);

ALTER TABLE "activity_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_entries_org_isolation" ON "activity_entries" FOR ALL USING (
  EXISTS (
    SELECT 1 FROM "emission_sources" es
    JOIN "facilities" f ON f."id" = es."facility_id"
    WHERE es."id" = "activity_entries"."source_id"
      AND f."org_id" = current_setting('app.current_org_id', true)::uuid
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM "emission_sources" es
    JOIN "facilities" f ON f."id" = es."facility_id"
    WHERE es."id" = "activity_entries"."source_id"
      AND f."org_id" = current_setting('app.current_org_id', true)::uuid
  )
);

ALTER TABLE "ledger_entries" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_entries_org_isolation" ON "ledger_entries" FOR ALL USING (
  EXISTS (
    SELECT 1 FROM "activity_entries" ae
    JOIN "emission_sources" es ON es."id" = ae."source_id"
    JOIN "facilities" f ON f."id" = es."facility_id"
    WHERE ae."id" = "ledger_entries"."activity_entry_id"
      AND f."org_id" = current_setting('app.current_org_id', true)::uuid
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM "activity_entries" ae
    JOIN "emission_sources" es ON es."id" = ae."source_id"
    JOIN "facilities" f ON f."id" = es."facility_id"
    WHERE ae."id" = "ledger_entries"."activity_entry_id"
      AND f."org_id" = current_setting('app.current_org_id', true)::uuid
  )
);
