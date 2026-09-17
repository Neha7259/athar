# PROJECT_BRIEF.md — Athar (أثر)

> **Read this file at the start of every Claude Code session.** It is the source of truth for scope, architecture, and decisions. Update the Decision Log at the bottom whenever an architectural call is made.

---

## 1. One-line pitch

**Athar is an audit-grade emissions ledger for UAE mid-market industrials — the system of record that turns fragmented bills, meter logs and invoices into a verifier-ready, IEQT-ready GHG inventory.**

Positioning: _Xero for carbon, built for the UAE MRV regime._ Not a calculator — a ledger.

---

## 2. Problem (why this exists)

- **Federal Decree-Law 11/2024 (UAE Climate Change Law)** applies to every entity emitting GHGs, with no size threshold. Scope 1+2 reporting was due 30 May 2026; Scope 3 expected from 2027. Fines AED 50k–2M (doubling on repeat).
- Submission must go through MOCCAE's **IEQT portal (mrv.ae)** — a compliance form, not a data system. It expects clean numbers; it does nothing to help produce them.
- Abu Dhabi facilities in covered sectors also report to **EAD's Facility-Level MRV**, which is the groundwork for a future **carbon price** — making emissions data a financial liability.
- Records must be retained **5 years** and be auditable. Third-party verification is being phased in (large entities now, SMEs ~2027).
- **The pain**: evidence is trapped in DEWA/ADDC/SEWA bills, ADNOC/ENOC fuel invoices, Tabreed/Empower district-cooling bills, refrigerant top-up logs, SCADA/CEMS exports and ERP data — half in Arabic. Mid-market plants have no sustainability team. Global tools (Sphera, Watershed) are enterprise-only; SME tools (Greenly, Zevero) are built for EU/CSRD. Local consultancies sell one-off spreadsheets that don't survive year two.

**Target user**: a 200–2,000-employee manufacturer / logistics operator / facility owner in JAFZA, KIZAD, Dubai Industrial City, SAIF Zone, Hamriyah, or Abu Dhabi industrial zones. Buyer persona: Head of Finance / Compliance / HSE. Daily user: plant or facilities manager. Secondary user: **MOCCAE-approved verifier**.

---

## 3. Product principles (non-negotiable)

1. **Every number is traceable.** Each tCO₂e figure links to an activity value → an evidence document (page/region) → an emission factor version → a user who confirmed it. No orphan numbers.
2. **Append-only ledger.** Nothing is overwritten. Corrections are new entries that supersede old ones. This is the trust moat.
3. **Human-in-the-loop AI.** LLM extraction proposes; a human confirms. Confidence scores are shown, never hidden.
4. **Regulator-shaped output.** Exports map 1:1 to IEQT and EAD template fields. If the regulator changes a template, we change a mapping file, not the ledger.
5. **Arabic + English first-class.** UI, document extraction, and exports.
6. **Multi-entity, multi-facility, multi-jurisdiction** from day one in the data model, even if the UI exposes it later.

---

## 4. MVP scope (Phase 1 — the vertical slice)

**Goal**: one facility can go from "folder of PDFs" to "verifier-ready Scope 1+2 inventory + IEQT export" end-to-end. This is the hackathon demo.

### In scope

- Org / facility onboarding (UAE Pass login + email/password fallback)
- **Evidence Vault**: upload PDFs/images/CSV; stored immutably with hash; 5-year retention flag
- **AI Extraction**: bills & invoices → structured activity data (kWh, litres, tonnes, kg refrigerant, TR-hours) with confidence + source-page bounding reference; Arabic + English
- **Source Register Builder**: guided conversational flow producing an IPCC-category-mapped register (stationary combustion, mobile combustion, process, fugitive/refrigerants, purchased electricity, purchased cooling)
- **Ledger + Calculation Engine**: activity × factor = emissions; versioned factor library (UAE grid factor per emirate, IPCC defaults, DEFRA fallback); GWP set (AR5/AR6) selectable
- **Data-Quality Checks**: missing months, unit anomalies, YoY jumps vs production, duplicate documents — explainable flags
- **Dashboard**: Scope 1/2 by source, by month, by facility; data completeness score; "verification readiness" score
- **Exports**: IEQT-format CSV/XLSX; EAD facility template; **Verifier Pack PDF** (inventory + evidence index + methodology + change log)
- **Reduction Plan (lite)**: AI-suggested measures per source with rough tCO₂e impact, owner, target date
- **Audit trail viewer**: full history of any number

### Explicitly out of scope for Phase 1

- Scope 3, carbon credit / NRCC integration, carbon-pricing simulation, billing/subscriptions, verifier marketplace, lender API, mobile app, real-time CEMS/IoT ingestion (design the interface, don't build it).

---

## 5. Architecture

```
/athar
  /apps
    /web          React 18 + Vite + TypeScript, TanStack Query, Zustand, react-i18next (ar/en, RTL), Tailwind + shadcn/ui, Recharts
    /api          Node 20 + Fastify + TypeScript, Zod validation, Drizzle ORM, OpenAPI docs
    /worker       BullMQ workers: document extraction, calculation runs, export generation, PDF rendering
  /packages
    /db           Drizzle schema + migrations (Postgres 16)
    /factors      Versioned emission-factor library (JSON + loader + tests)
    /extraction   LLM extraction module — `extractFromDocument(file, docType) → {fields, confidence, sourceRefs}`
    /calc         Pure calculation engine (no I/O) — unit conversion, factor resolution, GWP, rounding rules
    /exports      Template mappers: IEQT, EAD, Verifier Pack
    /shared       Types, enums (IPCC categories, units, scopes), utils
  /infra
    docker-compose.yml (postgres, redis, minio, api, worker, web)
    Jenkinsfile + GitHub Actions (lint, test, build, docker)
  /docs
    PROJECT_BRIEF.md (this file), DATA_MODEL.md, ADR/ (architecture decision records), DEMO_SCRIPT.md
```

### Stack decisions

| Concern        | Choice                                                                                                                   | Why                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| DB             | **Postgres 16**                                                                                                          | Relational integrity + append-only ledger + row-level security for multi-tenant. Not Mongo — this is accounting, not documents. |
| ORM            | Drizzle                                                                                                                  | Type-safe, migrations as code, no magic.                                                                                        |
| API            | Fastify + Zod + OpenAPI                                                                                                  | Fast, typed, auto-docs for verifier/lender integrations later.                                                                  |
| Jobs           | BullMQ on Redis                                                                                                          | Extraction and PDF generation are slow; must be async with retries.                                                             |
| Object storage | MinIO (S3-compatible) locally; S3/UAE-region bucket in prod                                                              | Data-residency story for investors and regulators.                                                                              |
| LLM            | Claude API (Sonnet for extraction, Haiku for classification/triage) with structured JSON output; pdf → images for vision | Arabic/English bills with tables; vision handles scanned invoices.                                                              |
| Vector search  | pgvector (Phase 2)                                                                                                       | Evidence semantic search; keep Postgres-only.                                                                                   |
| Auth           | UAE Pass (OIDC) + local auth; JWT + refresh; RBAC (Owner, Admin, Data Provider, Validator, Verifier-ReadOnly)            | Mirrors IEQT's role model.                                                                                                      |
| PDF            | Playwright (HTML → PDF)                                                                                                  | Full control over Verifier Pack layout, RTL support.                                                                            |
| Observability  | pino logs, OpenTelemetry traces, Sentry                                                                                  | Enterprise credibility.                                                                                                         |
| Testing        | Vitest (unit), Supertest (API), Playwright (e2e), golden-file tests for exports                                          | Calculation engine must have 100% coverage.                                                                                     |

---

## 6. Data model (core tables — see DATA_MODEL.md for full DDL)

```
organizations        id, name_en, name_ar, trade_license_no, emirate, hcee_flag
facilities           id, org_id, name, emirate, jurisdiction[] (MOCCAE|EAD), sector, coordinates, reporting_year_start
users / memberships  RBAC per org
emission_sources     id, facility_id, ipcc_category, scope, fuel_or_energy_type, unit, description, is_active
evidence_documents   id, org_id, sha256, storage_key, mime, doc_type, uploaded_by, uploaded_at, retention_until, ocr_lang
extractions          id, document_id, model, prompt_version, raw_json, confidence, status (proposed|confirmed|rejected), confirmed_by
activity_entries     id, source_id, period_start, period_end, quantity, unit, extraction_id, evidence_document_id, entered_by, superseded_by (nullable)
emission_factors     id, set_code (UAE-GRID-DXB-2025, IPCC-2006, DEFRA-2025…), category, unit_in, unit_out, value, gwp_set, valid_from, valid_to, source_url
ledger_entries       id, activity_entry_id, factor_id, co2e_tonnes, calc_version, computed_at, superseded_by (nullable)  -- APPEND ONLY
dq_flags             id, target_type, target_id, rule_code, severity, explanation, resolved_by, resolved_at
reduction_measures   id, facility_id, source_id, title, est_tco2e_per_year, capex_aed, owner_user_id, target_date, status
exports              id, org_id, template (IEQT|EAD|VERIFIER_PACK), reporting_year, storage_key, generated_at, ledger_snapshot_hash
audit_log            id, actor, action, entity, entity_id, before, after, at   -- immutable
```

Rules enforced in DB: `ledger_entries` and `audit_log` have no UPDATE/DELETE grants for the app role. Supersession is the only way to "change" a value.

---

## 7. AI stack — where the models actually sit

1. **Document classification** (Haiku): utility bill / fuel invoice / cooling invoice / refrigerant log / fleet statement / other; language detection.
2. **Structured extraction** (Sonnet, vision + structured output): per doc type, a Zod schema drives the JSON schema sent to the model. Output includes `sourceRefs: [{page, bbox?, snippet}]` so the UI can highlight where each value came from. Prompt versions are stored on each extraction row.
3. **Source Register assistant** (Sonnet, tool-use): conversational intake that calls `createEmissionSource` tools; grounded on IPCC category definitions in `/packages/shared`.
4. **DQ explainer**: rules engine produces flags; LLM writes the plain-language explanation and suggested fix. Rules decide, model explains — never the reverse.
5. **Reduction-measure generator**: given source mix + sector, propose measures with ranges; clearly labelled as estimates.
6. **Evals**: `/packages/extraction/evals` — 30+ anonymised sample bills (synthesised for the hackathon) with gold labels; extraction accuracy is a CI gate.

Guardrails: PII redaction before model calls; no model output enters the ledger without `status=confirmed`; token/cost logging per org.

---

## 8. Build plan (12 weeks, solo, Claude Code-driven)

Each sprint = one Claude Code "epic". Start each session with: _"Read PROJECT_BRIEF.md and DATA_MODEL.md. We are on Sprint N. Here's today's task…"_

| Sprint | Weeks | Deliverable                                                                         | Definition of done                                            |
| ------ | ----- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 0      | 1     | Monorepo, docker-compose, CI, lint/test scaffolding, DATA_MODEL.md, first migration | `docker compose up` gives a running API + web shell; CI green |
| 1      | 2     | Auth (local + UAE Pass stub), orgs/facilities/RBAC, i18n + RTL shell                | Can create org → facility → invite user                       |
| 2      | 3     | Evidence Vault (upload, hash, MinIO, retention), Source Register CRUD               | Documents immutable; sources mapped to IPCC categories        |
| 3      | 4–5   | Extraction module + worker + review UI (confirm/reject with highlighted source)     | 5 doc types extract with ≥90% field accuracy on eval set      |
| 4      | 6     | Factor library + calc engine + ledger (append-only)                                 | Golden tests pass; supersession works; audit log complete     |
| 5      | 7     | DQ rules + explanations; dashboard                                                  | Completeness + readiness scores live                          |
| 6      | 8–9   | Exports: IEQT, EAD, Verifier Pack PDF                                               | Field-by-field mapping documented; PDF renders RTL            |
| 7      | 10    | Source Register conversational assistant; Reduction Plan lite                       | Demo path fully AI-assisted                                   |
| 8      | 11    | Hardening: RLS, rate limits, OpenTelemetry, seed data, demo org                     | Security checklist passed                                     |
| 9      | 12    | DEMO_SCRIPT.md, pitch deck data, landing page, pilot outreach kit                   | 7-minute demo rehearsed end-to-end                            |

---

## 9. Hackathon / investor demo narrative (7 minutes)

1. **Hook (30s)**: "Every company in the UAE now has to file this. Here's what a plant manager's evidence folder actually looks like." (drop 12 messy PDFs, Arabic + English)
2. **Extraction (90s)**: watch them classify and extract; click a number → see the highlighted invoice line it came from.
3. **Register + Ledger (90s)**: conversational source register; calculation runs; open the audit trail on one figure → activity → document → factor version → who confirmed.
4. **DQ (60s)**: "May's diesel is 3× April with flat production" — flag, explanation, fix, supersession entry appears (old value never deleted).
5. **Exports (60s)**: one click → IEQT file, EAD file, Verifier Pack PDF with evidence index.
6. **Why it wins (60s)**: verifier time cut, two jurisdictions from one ledger, 5-year audit-proof retention, Scope 3 in 2027 is a new module on the same ledger, Abu Dhabi carbon pricing makes this data financially material.
7. **Ask (30s)**: 3 pilot facilities; verifier partners; free-zone channel.

---

## 10. Go-to-market notes (for the deck, not the code)

- **Channels**: free-zone business-services desks (JAFZA, KIZAD, DIC, SAIF, Hamriyah); accounting/ESG boutiques as resellers; MOCCAE-approved verifiers (they push clients to whatever makes verification cheap).
- **Pricing**: per facility per year, tiered by sources; Verifier Workspace add-on; consultancy white-label.
- **Moat**: evidence + supersession ledger + jurisdiction mappings + verifier workflow — _not_ the arithmetic.
- **Second waves**: Scope 3 (2027), SME assurance (2027), sector targets, Abu Dhabi carbon pricing, lender "MRV readiness" attestation API.

---

## 11. Risks & mitigations

| Risk                                  | Mitigation                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| IEQT adds ingestion/evidence features | Moat is verification workflow + multi-jurisdiction + ledger integrity, not calculation      |
| Methodology / factor changes          | Factor sets versioned with validity windows; recalculation creates new ledger entries       |
| Arabic extraction accuracy            | Vision models + eval set; human confirmation gate                                           |
| Data residency concerns               | UAE-region storage; document it in the security page                                        |
| Solo builder velocity                 | Strict MVP scope; calc engine and exports first-class tested; everything else "good enough" |

---

## 12. Working agreements with Claude Code

- Read this file and `DATA_MODEL.md` before writing code.
- TypeScript strict everywhere; no `any` in `/packages/calc` or `/packages/db`.
- Every new table → migration + Drizzle schema + seed + test.
- Every calc change → golden-file test update with justification in the PR description.
- Prefer small PRs per sprint task; run `pnpm lint && pnpm test` before declaring done.
- When unsure about a regulatory field, **do not invent** — add a `TODO(REG)` comment and log it in `/docs/REG_QUESTIONS.md`.
- Never write to `ledger_entries` or `audit_log` outside `/packages/calc` and the audit middleware.

---

## 13. First Claude Code prompt (copy-paste to start Sprint 0)

```
Read PROJECT_BRIEF.md fully. We are starting Sprint 0.

Set up the monorepo exactly as described in section 5 using pnpm workspaces, TypeScript strict, ESLint + Prettier, Vitest.
Create docker-compose.yml with postgres:16, redis:7, minio, and placeholders for api/worker/web.
Scaffold apps/api (Fastify + Zod + OpenAPI + pino + health endpoint) and apps/web (Vite React TS + Tailwind + i18n with ar/en and RTL toggle).
Create packages/db with Drizzle and write the FIRST migration covering: organizations, facilities, users, memberships, emission_sources, evidence_documents, emission_factors, activity_entries, ledger_entries, audit_log — following section 6, including the no-UPDATE/no-DELETE grant rule for ledger_entries and audit_log.
Write docs/DATA_MODEL.md documenting the schema and the supersession rule.
Add a GitHub Actions workflow that runs lint, typecheck, and tests.
Do not build any features yet. When finished, list what you created and any open questions under "Decision Log" candidates.
```

---

## 14. Decision Log

| Date       | Decision                                                                           | Rationale                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 2026-09-17 | Postgres over MongoDB for the ledger                                               | Append-only integrity, RLS multi-tenancy, relational factor/activity joins matter more than schema flexibility |
| 2026-09-17 | Human confirmation gate before any AI output enters the ledger                     | Regulatory defensibility; verifiers will ask "who signed off"                                                  |
| 2026-09-17 | Rules decide DQ flags; LLM only explains                                           | Deterministic, testable, auditable                                                                             |
| 2026-09-17 | Export templates as mapping files, not code branches                               | Regulator template churn is expected                                                                           |
| 2026-09-17 | MVP = single vertical slice to Verifier Pack; Scope 3 / carbon pricing deferred    | Hackathon demo needs one complete, convincing loop                                                             |
| 2026-09-17 | Extraction uses a provider-agnostic contract with a Claude adapter                 | Keep structured extraction tests independent of API credentials and model availability                         |
| 2026-09-17 | Demo factors are explicitly provisional until official UAE values are verified     | Never present an unverified factor as regulatory truth                                                         |
| 2026-09-17 | Local Evidence Vault uses content-addressed files as a development storage adapter | Preserve SHA-256 and retention behavior locally; switch the adapter to MinIO/S3 before pilot deployment        |
| 2026-09-17 | Source Register assistant always returns a draft requiring human confirmation      | AI may propose categories and units, but cannot write an emission source directly                              |
| 2026-09-17 | Synthetic extraction eval manifest covers 30 cases across five document types      | Keep the CI/eval contract ready while real anonymized bills are still unavailable                              |
| 2026-09-17 | API hardening starts with Helmet headers and configurable rate limiting            | Reduce common web/API exposure before pilot-specific RLS and observability work                                |
