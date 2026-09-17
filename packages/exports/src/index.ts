import type { IpccCategory, Scope, Unit } from '@athar/shared';

export interface InventoryExportRow {
  facilityName: string;
  sourceName: string;
  periodStart: string;
  periodEnd: string;
  scope: Scope;
  ipccCategory: IpccCategory;
  activityQuantity: number;
  activityUnit: Unit;
  factorSetCode: string;
  factorId: string;
  co2eTonnes: number;
  evidenceDocumentId?: string;
}

export interface EvidenceIndexRow {
  id: string;
  filename: string;
  sha256: string;
  retentionUntil: string;
  sourceRefs: string;
}

export interface VerifierPackInput {
  organizationName: string;
  facilityName: string;
  reportingYear: number;
  inventory: readonly InventoryExportRow[];
  evidence: readonly EvidenceIndexRow[];
  methodology: string;
  changeLog: readonly string[];
}

export const IEQT_MAPPING_STATUS = 'PENDING_OFFICIAL_TEMPLATE' as const;
export const EAD_MAPPING_STATUS = 'PENDING_OFFICIAL_TEMPLATE' as const;

function escapeCsv(value: string | number | undefined): string {
  const text = value === undefined ? '' : String(value);
  return /[",\n\r]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function inventoryToCsv(rows: readonly InventoryExportRow[]): string {
  const headers = [
    'facility_name',
    'source_name',
    'period_start',
    'period_end',
    'scope',
    'ipcc_category',
    'activity_quantity',
    'activity_unit',
    'factor_set_code',
    'factor_id',
    'co2e_tonnes',
    'evidence_document_id',
  ];
  const values = rows.map((row) => [
    row.facilityName,
    row.sourceName,
    row.periodStart,
    row.periodEnd,
    row.scope,
    row.ipccCategory,
    row.activityQuantity,
    row.activityUnit,
    row.factorSetCode,
    row.factorId,
    row.co2eTonnes,
    row.evidenceDocumentId,
  ]);
  return [headers, ...values].map((line) => line.map(escapeCsv).join(',')).join('\n');
}

export function buildVerifierPackHtml(input: VerifierPackInput): string {
  const inventoryRows = input.inventory
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.periodStart)}</td><td>${escapeHtml(row.sourceName)}</td><td>${escapeHtml(row.scope)}</td><td>${escapeHtml(row.ipccCategory)}</td><td>${row.co2eTonnes.toFixed(6)}</td><td>${escapeHtml(row.evidenceDocumentId)}</td></tr>`,
    )
    .join('');
  const evidenceRows = input.evidence
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.id)}</td><td>${escapeHtml(row.filename)}</td><td>${escapeHtml(row.sha256)}</td><td>${escapeHtml(row.retentionUntil)}</td><td>${escapeHtml(row.sourceRefs)}</td></tr>`,
    )
    .join('');
  const changeRows = input.changeLog.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Athar Verifier Pack</title><style>body{font-family:Arial,sans-serif;color:#17352a;margin:40px}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #c9d8ce;padding:6px;text-align:left;font-size:11px}th{background:#eaf3ed}h1{color:#185a3c}section{page-break-inside:avoid}</style></head><body><h1>Athar Verifier Pack</h1><p><strong>Organization:</strong> ${escapeHtml(input.organizationName)}<br><strong>Facility:</strong> ${escapeHtml(input.facilityName)}<br><strong>Reporting year:</strong> ${input.reportingYear}</p><section><h2>Inventory</h2><table><thead><tr><th>Period</th><th>Source</th><th>Scope</th><th>IPCC category</th><th>tCO2e</th><th>Evidence</th></tr></thead><tbody>${inventoryRows}</tbody></table></section><section><h2>Evidence index</h2><table><thead><tr><th>ID</th><th>Filename</th><th>SHA-256</th><th>Retention until</th><th>Source references</th></tr></thead><tbody>${evidenceRows}</tbody></table></section><section><h2>Methodology</h2><p>${escapeHtml(input.methodology)}</p></section><section><h2>Change log</h2><ul>${changeRows}</ul></section></body></html>`;
}

function escapeHtml(value: string | undefined): string {
  return (value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
