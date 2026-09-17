import type { DqSeverity, Unit } from '@athar/shared';

export interface QualityActivity {
  id: string;
  sourceId: string;
  periodStart: string;
  quantity: number;
  unit: Unit;
  evidenceDocumentId?: string;
  documentSha256?: string;
}

export interface QualityFlag {
  targetType: 'activity_entry' | 'evidence_document' | 'source';
  targetId: string;
  ruleCode: 'MISSING_MONTH' | 'UNIT_ANOMALY' | 'YOY_JUMP' | 'DUPLICATE_DOC';
  severity: DqSeverity;
  explanation: string;
}

export interface QualityOptions {
  reportingYear: number;
  expectedUnitBySource?: ReadonlyMap<string, Unit>;
  jumpMultiplier?: number;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function expectedMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
}

export function findMissingMonths(
  entries: readonly QualityActivity[],
  year: number,
): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const bySource = new Map<string, Set<string>>();
  for (const entry of entries) {
    const months = bySource.get(entry.sourceId) ?? new Set<string>();
    months.add(monthKey(entry.periodStart));
    bySource.set(entry.sourceId, months);
  }
  for (const [sourceId, months] of bySource) {
    for (const month of expectedMonths(year)) {
      if (!months.has(month)) {
        flags.push({
          targetType: 'source',
          targetId: sourceId,
          ruleCode: 'MISSING_MONTH',
          severity: 'warning',
          explanation: `No activity entry found for ${month}`,
        });
      }
    }
  }
  return flags;
}

export function findUnitAnomalies(
  entries: readonly QualityActivity[],
  expectedUnitBySource: ReadonlyMap<string, Unit>,
): QualityFlag[] {
  return entries
    .filter(
      (entry) =>
        expectedUnitBySource.get(entry.sourceId) !== undefined &&
        expectedUnitBySource.get(entry.sourceId) !== entry.unit,
    )
    .map((entry) => ({
      targetType: 'activity_entry' as const,
      targetId: entry.id,
      ruleCode: 'UNIT_ANOMALY' as const,
      severity: 'error' as const,
      explanation: `Entry uses ${entry.unit}; source expects ${expectedUnitBySource.get(entry.sourceId)}`,
    }));
}

export function findYearOnYearJumps(
  entries: readonly QualityActivity[],
  multiplier = 3,
): QualityFlag[] {
  const bySourceMonth = new Map<string, QualityActivity>();
  for (const entry of entries)
    bySourceMonth.set(`${entry.sourceId}:${monthKey(entry.periodStart)}`, entry);
  const flags: QualityFlag[] = [];
  for (const entry of entries) {
    const priorYear = String(Number(entry.periodStart.slice(0, 4)) - 1);
    const prior = bySourceMonth.get(
      `${entry.sourceId}:${priorYear}${entry.periodStart.slice(4, 7)}`,
    );
    if (prior && prior.quantity > 0 && entry.quantity >= prior.quantity * multiplier) {
      flags.push({
        targetType: 'activity_entry',
        targetId: entry.id,
        ruleCode: 'YOY_JUMP',
        severity: 'warning',
        explanation: `Quantity is ${entry.quantity / prior.quantity}x the prior-year value for the same month`,
      });
    }
  }
  return flags;
}

export function findDuplicateDocuments(entries: readonly QualityActivity[]): QualityFlag[] {
  const byHash = new Map<string, QualityActivity[]>();
  for (const entry of entries) {
    if (!entry.documentSha256 || !entry.evidenceDocumentId) continue;
    const matches = byHash.get(entry.documentSha256) ?? [];
    matches.push(entry);
    byHash.set(entry.documentSha256, matches);
  }
  return [...byHash.values()]
    .filter((matches) => matches.length > 1)
    .flatMap((matches) =>
      matches.map((entry) => ({
        targetType: 'evidence_document' as const,
        targetId: entry.evidenceDocumentId!,
        ruleCode: 'DUPLICATE_DOC' as const,
        severity: 'error' as const,
        explanation: `Document hash ${entry.documentSha256} is linked to multiple activity entries`,
      })),
    );
}

export function runDataQualityChecks(
  entries: readonly QualityActivity[],
  options: QualityOptions,
): QualityFlag[] {
  return [
    ...findMissingMonths(entries, options.reportingYear),
    ...findUnitAnomalies(entries, options.expectedUnitBySource ?? new Map()),
    ...findYearOnYearJumps(entries, options.jumpMultiplier ?? 3),
    ...findDuplicateDocuments(entries),
  ];
}
