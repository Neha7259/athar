# DATA_MODEL.md — Athar

> Source of truth for the database schema. Every change here requires a Drizzle migration in `packages/db/drizzle` and an entry in the PROJECT_BRIEF Decision Log if architectural.

## Principles

1. **Append-only ledger.** `ledger_entries` and `audit_log` are immutable for the application role (`athar_app`). The migration revokes `UPDATE` and `DELETE`. "Changing" a value = inserting a new row and pointing the old row's `superseded_by` at it (performed by a controlled DB function in a later sprint; never a raw UPDATE from app code).
2. **Traceability chain.** Every `ledger_entries.co2e_tonnes` resolves: `ledger_entry → activity_entry → (extraction → evidence_document) + emission_factor(version) + entered_by/confirmed_by users`. No orphan numbers.
3. **Multi-entity from day one.** `organizations → facilities → emission_sources`. RBAC via `memberships`. Row-level security is added in Sprint 8.
4. **Enum discipline.** Domain enums (scopes, IPCC categories, units, doc types, roles…) are defined once in `@athar/shared` and mirrored as Postgres enums.

## Supersession rule

- `activity_entries.superseded_by` and `ledger_entries.superseded_by` are nullable self-references.
- A row with `superseded_by IS NULL` is **current**; anything else is historical.
- Corrections insert a new row; the old row is only touched to set `superseded_by` (via SECURITY DEFINER function `supersede_ledger_entry`, Sprint 4). App role cannot UPDATE these tables directly.
- Queries for "the inventory" always filter `superseded_by IS NULL`. The audit trail viewer walks the chain.

## Tables

### organizations

| column            | type           | notes                                    |
| ----------------- | -------------- | ---------------------------------------- |
| id                | uuid pk        |                                          |
| name_en / name_ar | text           | Arabic name optional                     |
| trade_license_no  | text           |                                          |
| emirate           | enum `emirate` | 7 emirates                               |
| hcee_flag         | boolean        | "high climate effect entity" designation |
| created_at        | timestamptz    |                                          |

### facilities

| column               | type                  | notes                        |
| -------------------- | --------------------- | ---------------------------- |
| id                   | uuid pk               |                              |
| org_id               | uuid fk organizations |                              |
| name                 | text                  |                              |
| emirate              | enum                  | drives grid-factor selection |
| jurisdictions        | text[]                | subset of {MOCCAE, EAD}      |
| sector               | text                  |                              |
| latitude / longitude | numeric(9,6)          |                              |
| reporting_year_start | int                   | month number, default 1      |

### users / memberships

- `users`: email (unique), password_hash (nullable — UAE Pass users), uae_pass_sub (unique, nullable), display_name, locale.
- `memberships`: (org_id, user_id) unique, `role` enum: owner, admin, data_provider, validator, verifier_readonly. Mirrors IEQT's role model.

### emission_sources

| column              | type        | notes                                                                                                                        |
| ------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| id                  | uuid pk     |                                                                                                                              |
| facility_id         | uuid fk     |                                                                                                                              |
| ipcc_category       | enum        | stationary_combustion, mobile_combustion, process_emissions, fugitive_refrigerants, purchased_electricity, purchased_cooling |
| scope               | enum        | scope1 / scope2 — must match category (enforced in app layer + shared helper `scopeOfCategory`)                              |
| fuel_or_energy_type | text        | e.g. diesel, natural_gas, grid_electricity_dubai, r410a                                                                      |
| unit                | enum `unit` | canonical unit for entries against this source                                                                               |
| description         | text        |                                                                                                                              |
| is_active           | boolean     |                                                                                                                              |

### evidence_documents

Immutable once written (no app-role UPDATE on content columns; enforced fully with RLS in Sprint 8).
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| org_id | uuid fk | |
| sha256 | text | content hash — dedupe + tamper evidence |
| storage_key | text unique | MinIO/S3 object key |
| mime, doc_type, original_filename | | doc_type enum: utility_bill, fuel_invoice, cooling_invoice, refrigerant_log, fleet_statement, meter_log, other |
| uploaded_by / uploaded_at | | |
| retention_until | date | upload date + 5 years (UAE law) |
| ocr_lang | enum | ar / en / mixed |

### extractions

| column                      | type         | notes                                                                                      |
| --------------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| id                          | uuid pk      |                                                                                            |
| document_id                 | uuid fk      |                                                                                            |
| model                       | text         | e.g. claude-sonnet-4-5                                                                     |
| prompt_version              | text         | pinned per extraction for reproducibility                                                  |
| raw_json                    | jsonb        | full model output incl. sourceRefs (page/bbox/snippet)                                     |
| confidence                  | numeric(4,3) | 0–1                                                                                        |
| status                      | enum         | proposed → confirmed / rejected. **Only confirmed extractions may feed activity_entries.** |
| confirmed_by / confirmed_at |              | the human gate                                                                             |

### emission_factors

| column                | type               | notes                                                                 |
| --------------------- | ------------------ | --------------------------------------------------------------------- |
| id                    | uuid pk            |                                                                       |
| set_code              | text               | e.g. `UAE-GRID-DXB-2025`, `IPCC-2006`, `DEFRA-2025`                   |
| category              | enum ipcc_category |                                                                       |
| fuel_or_energy_type   | text               | joins to emission_sources.fuel_or_energy_type                         |
| unit_in               | enum unit          | activity unit                                                         |
| unit_out              | text               | always `tCO2e` for now                                                |
| value                 | numeric(18,9)      | tCO2e per unit_in                                                     |
| gwp_set               | enum               | AR5 / AR6                                                             |
| valid_from / valid_to | date               | validity window; recalcs use the factor valid for the activity period |
| source_url            | text               | provenance                                                            |

### activity_entries

| column                    | type                     | notes                                  |
| ------------------------- | ------------------------ | -------------------------------------- |
| id                        | uuid pk                  |                                        |
| source_id                 | uuid fk emission_sources |                                        |
| period_start / period_end | date                     | billing/measurement period             |
| quantity                  | numeric(18,6)            |                                        |
| unit                      | enum                     | must be convertible to the source unit |
| extraction_id             | uuid fk nullable         | null = manual entry                    |
| evidence_document_id      | uuid fk nullable         | evidence link                          |
| entered_by / entered_at   |                          |                                        |
| superseded_by             | uuid nullable            | supersession chain                     |

### ledger_entries — APPEND ONLY

| column            | type          | notes                     |
| ----------------- | ------------- | ------------------------- |
| id                | uuid pk       |                           |
| activity_entry_id | uuid fk       |                           |
| factor_id         | uuid fk       | exact factor version used |
| co2e_tonnes       | numeric(18,6) |                           |
| calc_version      | text          | calc engine semver        |
| computed_at       | timestamptz   |                           |
| superseded_by     | uuid nullable |                           |

**Grants:** `REVOKE UPDATE, DELETE ON ledger_entries FROM athar_app;` Written only by `/packages/calc` via the worker.

### dq_flags

Rules engine output. `target_type` + `target_id` polymorphic reference; `rule_code` (e.g. `MISSING_MONTH`, `UNIT_ANOMALY`, `YOY_JUMP`, `DUPLICATE_DOC`); `severity` info/warning/error; `explanation` (LLM-written plain language; rule decided the flag).

### reduction_measures

Facility-level measures: title, est_tco2e_per_year, capex_aed, owner_user_id, target_date, status (proposed/planned/in_progress/done/dropped).

### exports

Generated artifacts: template (IEQT / EAD / VERIFIER_PACK), reporting_year, storage_key, `ledger_snapshot_hash` — SHA-256 over the current (non-superseded) ledger rows at generation time, so any later change is detectable.

### audit_log — IMMUTABLE

actor, action, entity, entity_id, before/after jsonb, at. `REVOKE UPDATE, DELETE FROM athar_app;` Written only by the audit middleware.

## Roles & grants (migration `0001_grants`)

- `athar_app` — the API/worker runtime role: full CRUD on ordinary tables, **INSERT+SELECT only** on `ledger_entries` and `audit_log`.
- Migrations run as the owner role (e.g. `athar`), which retains DDL rights.

## Open TODO(REG)

- Exact IEQT field list not publicly documented — mapping file stub in `/packages/exports` pending portal access. See `docs/REG_QUESTIONS.md`.
- EAD facility template version to confirm with a pilot verifier.
