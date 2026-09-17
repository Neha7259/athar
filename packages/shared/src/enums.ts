export const SCOPES = ['scope1', 'scope2'] as const;
export type Scope = (typeof SCOPES)[number];

export const EMIRATES = [
  'abu_dhabi',
  'dubai',
  'sharjah',
  'ajman',
  'umm_al_quwain',
  'ras_al_khaimah',
  'fujairah',
] as const;
export type Emirate = (typeof EMIRATES)[number];

export const JURISDICTIONS = ['MOCCAE', 'EAD'] as const;
export type Jurisdiction = (typeof JURISDICTIONS)[number];

export const ROLES = ['owner', 'admin', 'data_provider', 'validator', 'verifier_readonly'] as const;
export type Role = (typeof ROLES)[number];

export const DOC_TYPES = [
  'utility_bill',
  'fuel_invoice',
  'cooling_invoice',
  'refrigerant_log',
  'fleet_statement',
  'meter_log',
  'other',
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const EXTRACTION_STATUSES = ['proposed', 'confirmed', 'rejected'] as const;
export type ExtractionStatus = (typeof EXTRACTION_STATUSES)[number];

export const GWP_SETS = ['AR5', 'AR6'] as const;
export type GwpSet = (typeof GWP_SETS)[number];

export const EXPORT_TEMPLATES = ['IEQT', 'EAD', 'VERIFIER_PACK'] as const;
export type ExportTemplate = (typeof EXPORT_TEMPLATES)[number];

export const DQ_SEVERITIES = ['info', 'warning', 'error'] as const;
export type DqSeverity = (typeof DQ_SEVERITIES)[number];

export const OCR_LANGS = ['ar', 'en', 'mixed'] as const;
export type OcrLang = (typeof OCR_LANGS)[number];

export const MEASURE_STATUSES = ['proposed', 'planned', 'in_progress', 'done', 'dropped'] as const;
export type MeasureStatus = (typeof MEASURE_STATUSES)[number];
