-- =====================================================================
-- Migration 0000: Initial Athar schema
-- Sprint 0 — written manually (drizzle-kit generate workaround for
-- ESM monorepo; fix tooling in Sprint 1 task tracker)
-- =====================================================================

-- Enums
CREATE TYPE "emirate" AS ENUM(
  'abu_dhabi','dubai','sharjah','ajman','umm_al_quwain','ras_al_khaimah','fujairah'
);
CREATE TYPE "role" AS ENUM(
  'owner','admin','data_provider','validator','verifier_readonly'
);
CREATE TYPE "scope" AS ENUM('scope1','scope2');
CREATE TYPE "ipcc_category" AS ENUM(
  'stationary_combustion','mobile_combustion','process_emissions',
  'fugitive_refrigerants','purchased_electricity','purchased_cooling'
);
CREATE TYPE "doc_type" AS ENUM(
  'utility_bill','fuel_invoice','cooling_invoice','refrigerant_log',
  'fleet_statement','meter_log','other'
);
CREATE TYPE "extraction_status" AS ENUM('proposed','confirmed','rejected');
CREATE TYPE "gwp_set" AS ENUM('AR5','AR6');
CREATE TYPE "export_template" AS ENUM('IEQT','EAD','VERIFIER_PACK');
CREATE TYPE "dq_severity" AS ENUM('info','warning','error');
CREATE TYPE "ocr_lang" AS ENUM('ar','en','mixed');
CREATE TYPE "unit" AS ENUM('kWh','MWh','litre','m3','kg','tonne','TR_hour','km','GJ');
CREATE TYPE "measure_status" AS ENUM('proposed','planned','in_progress','done','dropped');

-- Core tables
CREATE TABLE "organizations" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name_en"          TEXT NOT NULL,
  "name_ar"          TEXT,
  "trade_license_no" TEXT,
  "emirate"          emirate NOT NULL,
  "hcee_flag"        BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "facilities" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"                UUID NOT NULL REFERENCES organizations(id),
  "name"                  TEXT NOT NULL,
  "emirate"               emirate NOT NULL,
  "jurisdictions"         TEXT[] NOT NULL DEFAULT ARRAY['MOCCAE'],
  "sector"                TEXT,
  "latitude"              NUMERIC(9,6),
  "longitude"             NUMERIC(9,6),
  "reporting_year_start"  INTEGER NOT NULL DEFAULT 1,
  "created_at"            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "users" (
  "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email"         TEXT NOT NULL UNIQUE,
  "password_hash" TEXT,
  "uae_pass_sub"  TEXT UNIQUE,
  "display_name"  TEXT NOT NULL,
  "locale"        TEXT NOT NULL DEFAULT 'en',
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "memberships" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"     UUID NOT NULL REFERENCES organizations(id),
  "user_id"    UUID NOT NULL REFERENCES users(id),
  "role"       role NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "memberships_org_user_uq" UNIQUE ("org_id", "user_id")
);

CREATE TABLE "emission_sources" (
  "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "facility_id"        UUID NOT NULL REFERENCES facilities(id),
  "ipcc_category"      ipcc_category NOT NULL,
  "scope"              scope NOT NULL,
  "fuel_or_energy_type" TEXT NOT NULL,
  "unit"               unit NOT NULL,
  "description"        TEXT,
  "is_active"          BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "evidence_documents" (
  "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"           UUID NOT NULL REFERENCES organizations(id),
  "sha256"           TEXT NOT NULL,
  "storage_key"      TEXT NOT NULL UNIQUE,
  "mime"             TEXT NOT NULL,
  "doc_type"         doc_type NOT NULL DEFAULT 'other',
  "original_filename" TEXT NOT NULL,
  "uploaded_by"      UUID NOT NULL REFERENCES users(id),
  "uploaded_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "retention_until"  DATE NOT NULL,
  "ocr_lang"         ocr_lang
);

CREATE TABLE "extractions" (
  "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id"    UUID NOT NULL REFERENCES evidence_documents(id),
  "model"          TEXT NOT NULL,
  "prompt_version" TEXT NOT NULL,
  "raw_json"       JSONB NOT NULL,
  "confidence"     NUMERIC(4,3),
  "status"         extraction_status NOT NULL DEFAULT 'proposed',
  "confirmed_by"   UUID REFERENCES users(id),
  "confirmed_at"   TIMESTAMPTZ,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "emission_factors" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "set_code"            TEXT NOT NULL,
  "category"            ipcc_category NOT NULL,
  "fuel_or_energy_type" TEXT NOT NULL,
  "unit_in"             unit NOT NULL,
  "unit_out"            TEXT NOT NULL DEFAULT 'tCO2e',
  "value"               NUMERIC(18,9) NOT NULL,
  "gwp_set"             gwp_set NOT NULL,
  "valid_from"          DATE NOT NULL,
  "valid_to"            DATE,
  "source_url"          TEXT,
  "created_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "activity_entries" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_id"           UUID NOT NULL REFERENCES emission_sources(id),
  "period_start"        DATE NOT NULL,
  "period_end"          DATE NOT NULL,
  "quantity"            NUMERIC(18,6) NOT NULL,
  "unit"                unit NOT NULL,
  "extraction_id"       UUID REFERENCES extractions(id),
  "evidence_document_id" UUID REFERENCES evidence_documents(id),
  "entered_by"          UUID NOT NULL REFERENCES users(id),
  "entered_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "superseded_by"       UUID  -- self-ref; FK added below
);

-- APPEND ONLY (no UPDATE/DELETE for athar_app)
CREATE TABLE "ledger_entries" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "activity_entry_id" UUID NOT NULL REFERENCES activity_entries(id),
  "factor_id"         UUID NOT NULL REFERENCES emission_factors(id),
  "co2e_tonnes"       NUMERIC(18,6) NOT NULL,
  "calc_version"      TEXT NOT NULL,
  "computed_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "superseded_by"     UUID  -- self-ref; FK added below
);

CREATE TABLE "dq_flags" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "target_type" TEXT NOT NULL,
  "target_id"   UUID NOT NULL,
  "rule_code"   TEXT NOT NULL,
  "severity"    dq_severity NOT NULL,
  "explanation" TEXT NOT NULL,
  "resolved_by" UUID REFERENCES users(id),
  "resolved_at" TIMESTAMPTZ,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "reduction_measures" (
  "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "facility_id"       UUID NOT NULL REFERENCES facilities(id),
  "source_id"         UUID REFERENCES emission_sources(id),
  "title"             TEXT NOT NULL,
  "est_tco2e_per_year" NUMERIC(18,6),
  "capex_aed"         NUMERIC(18,2),
  "owner_user_id"     UUID REFERENCES users(id),
  "target_date"       DATE,
  "status"            measure_status NOT NULL DEFAULT 'proposed',
  "created_at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "exports" (
  "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"                UUID NOT NULL REFERENCES organizations(id),
  "template"              export_template NOT NULL,
  "reporting_year"        INTEGER NOT NULL,
  "storage_key"           TEXT NOT NULL,
  "generated_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "ledger_snapshot_hash"  TEXT NOT NULL
);

-- IMMUTABLE (no UPDATE/DELETE for athar_app)
CREATE TABLE "audit_log" (
  "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor"     UUID REFERENCES users(id),
  "action"    TEXT NOT NULL,
  "entity"    TEXT NOT NULL,
  "entity_id" UUID,
  "before"    JSONB,
  "after"     JSONB,
  "at"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Self-referential FK for supersession chains
ALTER TABLE "activity_entries"
  ADD CONSTRAINT "activity_entries_superseded_by_fk"
  FOREIGN KEY ("superseded_by") REFERENCES activity_entries(id);

ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_superseded_by_fk"
  FOREIGN KEY ("superseded_by") REFERENCES ledger_entries(id);

-- =====================================================================
-- RBAC: create application role and revoke destructive operations
-- on append-only tables. Run as the owner (migration) role.
-- =====================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'athar_app') THEN
    CREATE ROLE athar_app LOGIN PASSWORD 'athar_app_dev';
  END IF;
END
$$;

GRANT CONNECT ON DATABASE athar TO athar_app;
GRANT USAGE ON SCHEMA public TO athar_app;

-- Grant full CRUD on regular tables
GRANT SELECT, INSERT, UPDATE, DELETE ON
  organizations, facilities, users, memberships,
  emission_sources, evidence_documents, extractions,
  emission_factors, activity_entries,
  dq_flags, reduction_measures, exports
TO athar_app;

-- Append-only: INSERT + SELECT only
GRANT SELECT, INSERT ON ledger_entries TO athar_app;
GRANT SELECT, INSERT ON audit_log TO athar_app;

-- Sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO athar_app;
