import { describe, expect, it } from 'vitest';
import {
  findDuplicateDocuments,
  findMissingMonths,
  findUnitAnomalies,
  findYearOnYearJumps,
  runDataQualityChecks,
  type QualityActivity,
} from './index.js';

const entries: QualityActivity[] = [
  {
    id: '2025-01',
    sourceId: 'source-1',
    periodStart: '2025-01-01',
    quantity: 100,
    unit: 'kWh',
    evidenceDocumentId: 'doc-1',
    documentSha256: 'same',
  },
  {
    id: '2026-01',
    sourceId: 'source-1',
    periodStart: '2026-01-01',
    quantity: 400,
    unit: 'MWh',
    evidenceDocumentId: 'doc-1',
    documentSha256: 'same',
  },
];

describe('data quality rules', () => {
  it('flags missing months by source', () => {
    const flags = findMissingMonths(entries, 2026);
    expect(flags).toHaveLength(11);
    expect(flags[0]?.ruleCode).toBe('MISSING_MONTH');
  });
  it('flags unexpected units as errors', () => {
    const flags = findUnitAnomalies(entries, new Map([['source-1', 'kWh']]));
    expect(flags).toHaveLength(1);
    expect(flags[0]?.severity).toBe('error');
  });
  it('flags a three-times year-on-year jump', () => {
    expect(findYearOnYearJumps(entries)).toMatchObject([
      { targetId: '2026-01', ruleCode: 'YOY_JUMP' },
    ]);
  });
  it('flags duplicate evidence hashes', () => {
    expect(findDuplicateDocuments(entries)).toHaveLength(2);
  });
  it('composes all deterministic rules', () => {
    expect(
      runDataQualityChecks(entries, {
        reportingYear: 2026,
        expectedUnitBySource: new Map([['source-1', 'kWh']]),
      }).length,
    ).toBeGreaterThan(10);
  });
});
