import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Enum tuples inlined here so drizzle-kit (CJS runner) does not need to resolve
// the @athar/shared ESM workspace package. Keep these in sync with packages/shared/src/enums.ts.
const EMIRATES = [
  'abu_dhabi', 'dubai', 'sharjah', 'ajman', 'umm_al_quwain', 'ras_al_khaimah', 'fujairah',
] as const;
const ROLES = ['owner', 'admin', 'data_provider', 'validator', 'verifier_readonly'] as const;
const SCOPES = ['scope1', 'scope2'] as const;
const IPCC_CATEGORIES = [
  'stationary_combustion', 'mobile_combustion', 'process_emissions',
  'fugitive_refrigerants', 'purchased_electricity', 'purchased_cooling',
] as const;
const DOC_TYPES = [
  'utility_bill', 'fuel_invoice', 'cooling_invoice', 'refrigerant_log',
  'fleet_statement', 'meter_log', 'other',
] as const;
const EXTRACTION_STATUSES = ['proposed', 'confirmed', 'rejected'] as const;
const GWP_SETS = ['AR5', 'AR6'] as const;
const EXPORT_TEMPLATES = ['IEQT', 'EAD', 'VERIFIER_PACK'] as const;
const DQ_SEVERITIES = ['info', 'warning', 'error'] as const;
const OCR_LANGS = ['ar', 'en', 'mixed'] as const;
const UNITS = ['kWh', 'MWh', 'litre', 'm3', 'kg', 'tonne', 'TR_hour', 'km', 'GJ'] as const;
const MEASURE_STATUSES = ['proposed', 'planned', 'in_progress', 'done', 'dropped'] as const;

export const emirateEnum = pgEnum('emirate', EMIRATES);
export const roleEnum = pgEnum('role', ROLES);
export const scopeEnum = pgEnum('scope', SCOPES);
export const ipccCategoryEnum = pgEnum('ipcc_category', IPCC_CATEGORIES);
export const docTypeEnum = pgEnum('doc_type', DOC_TYPES);
export const extractionStatusEnum = pgEnum('extraction_status', EXTRACTION_STATUSES);
export const gwpSetEnum = pgEnum('gwp_set', GWP_SETS);
export const exportTemplateEnum = pgEnum('export_template', EXPORT_TEMPLATES);
export const dqSeverityEnum = pgEnum('dq_severity', DQ_SEVERITIES);
export const ocrLangEnum = pgEnum('ocr_lang', OCR_LANGS);
export const unitEnum = pgEnum('unit', UNITS);
export const measureStatusEnum = pgEnum('measure_status', MEASURE_STATUSES);

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameEn: text('name_en').notNull(),
  nameAr: text('name_ar'),
  tradeLicenseNo: text('trade_license_no'),
  emirate: emirateEnum('emirate').notNull(),
  hceeFlag: boolean('hcee_flag').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const facilities = pgTable('facilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  name: text('name').notNull(),
  emirate: emirateEnum('emirate').notNull(),
  /** Which regulators this facility reports to: MOCCAE and/or EAD. */
  jurisdictions: text('jurisdictions').array().notNull().default(['MOCCAE']),
  sector: text('sector'),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  reportingYearStart: integer('reporting_year_start').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  uaePassSub: text('uae_pass_sub').unique(),
  displayName: text('display_name').notNull(),
  locale: text('locale').notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: roleEnum('role').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('memberships_org_user_uq').on(t.orgId, t.userId)],
);

export const emissionSources = pgTable('emission_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  facilityId: uuid('facility_id')
    .notNull()
    .references(() => facilities.id),
  ipccCategory: ipccCategoryEnum('ipcc_category').notNull(),
  scope: scopeEnum('scope').notNull(),
  fuelOrEnergyType: text('fuel_or_energy_type').notNull(),
  unit: unitEnum('unit').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const evidenceDocuments = pgTable('evidence_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  sha256: text('sha256').notNull(),
  storageKey: text('storage_key').notNull().unique(),
  mime: text('mime').notNull(),
  docType: docTypeEnum('doc_type').notNull().default('other'),
  originalFilename: text('original_filename').notNull(),
  uploadedBy: uuid('uploaded_by')
    .notNull()
    .references(() => users.id),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  retentionUntil: date('retention_until').notNull(),
  ocrLang: ocrLangEnum('ocr_lang'),
});

export const extractions = pgTable('extractions', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => evidenceDocuments.id),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  rawJson: jsonb('raw_json').notNull(),
  confidence: numeric('confidence', { precision: 4, scale: 3 }),
  status: extractionStatusEnum('status').notNull().default('proposed'),
  confirmedBy: uuid('confirmed_by').references(() => users.id),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const emissionFactors = pgTable('emission_factors', {
  id: uuid('id').primaryKey().defaultRandom(),
  setCode: text('set_code').notNull(), // e.g. UAE-GRID-DXB-2025, IPCC-2006, DEFRA-2025
  category: ipccCategoryEnum('category').notNull(),
  fuelOrEnergyType: text('fuel_or_energy_type').notNull(),
  unitIn: unitEnum('unit_in').notNull(),
  unitOut: text('unit_out').notNull().default('tCO2e'),
  value: numeric('value', { precision: 18, scale: 9 }).notNull(),
  gwpSet: gwpSetEnum('gwp_set').notNull(),
  validFrom: date('valid_from').notNull(),
  validTo: date('valid_to'),
  sourceUrl: text('source_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const activityEntries = pgTable('activity_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: uuid('source_id')
    .notNull()
    .references(() => emissionSources.id),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  quantity: numeric('quantity', { precision: 18, scale: 6 }).notNull(),
  unit: unitEnum('unit').notNull(),
  extractionId: uuid('extraction_id').references(() => extractions.id),
  evidenceDocumentId: uuid('evidence_document_id').references(() => evidenceDocuments.id),
  enteredBy: uuid('entered_by')
    .notNull()
    .references(() => users.id),
  enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
  supersededBy: uuid('superseded_by'),
});

/** APPEND ONLY — app role has no UPDATE/DELETE grants (except setting superseded_by via SECURITY DEFINER fn in later sprint; for now supersession is insert + controlled update by migration-owned role). */
export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  activityEntryId: uuid('activity_entry_id')
    .notNull()
    .references(() => activityEntries.id),
  factorId: uuid('factor_id')
    .notNull()
    .references(() => emissionFactors.id),
  co2eTonnes: numeric('co2e_tonnes', { precision: 18, scale: 6 }).notNull(),
  calcVersion: text('calc_version').notNull(),
  computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  supersededBy: uuid('superseded_by'),
});

export const dqFlags = pgTable('dq_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  targetType: text('target_type').notNull(), // 'activity_entry' | 'evidence_document' | 'source'
  targetId: uuid('target_id').notNull(),
  ruleCode: text('rule_code').notNull(),
  severity: dqSeverityEnum('severity').notNull(),
  explanation: text('explanation').notNull(),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reductionMeasures = pgTable('reduction_measures', {
  id: uuid('id').primaryKey().defaultRandom(),
  facilityId: uuid('facility_id')
    .notNull()
    .references(() => facilities.id),
  sourceId: uuid('source_id').references(() => emissionSources.id),
  title: text('title').notNull(),
  estTco2ePerYear: numeric('est_tco2e_per_year', { precision: 18, scale: 6 }),
  capexAed: numeric('capex_aed', { precision: 18, scale: 2 }),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  targetDate: date('target_date'),
  status: measureStatusEnum('status').notNull().default('proposed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const exports = pgTable('exports', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organizations.id),
  template: exportTemplateEnum('template').notNull(),
  reportingYear: integer('reporting_year').notNull(),
  storageKey: text('storage_key').notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  ledgerSnapshotHash: text('ledger_snapshot_hash').notNull(),
});

/** IMMUTABLE — app role has no UPDATE/DELETE grants. */
export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  actor: uuid('actor').references(() => users.id),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: uuid('entity_id'),
  before: jsonb('before'),
  after: jsonb('after'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});
