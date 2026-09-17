import { describe, expect, it } from 'vitest';
import {
  buildVerifierPackHtml,
  inventoryToCsv,
  IEQT_MAPPING_STATUS,
  type InventoryExportRow,
} from './index.js';

const row: InventoryExportRow = {
  facilityName: 'KIZAD Plant',
  sourceName: 'Grid electricity',
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  scope: 'scope2',
  ipccCategory: 'purchased_electricity',
  activityQuantity: 1500,
  activityUnit: 'kWh',
  factorSetCode: 'UAE-GRID-DXB-2025-PROVISIONAL',
  factorId: 'factor-1',
  co2eTonnes: 0.6,
  evidenceDocumentId: 'doc-1',
};

describe('exports', () => {
  it('serializes traceable inventory rows to CSV', () => {
    const csv = inventoryToCsv([row]);
    expect(csv).toContain('factor_set_code');
    expect(csv).toContain('UAE-GRID-DXB-2025-PROVISIONAL');
    expect(csv.split('\n')).toHaveLength(2);
  });
  it('escapes CSV values containing commas', () => {
    expect(inventoryToCsv([{ ...row, sourceName: 'Grid, main meter' }])).toContain(
      '"Grid, main meter"',
    );
  });
  it('builds an HTML verifier pack with evidence and methodology', () => {
    const html = buildVerifierPackHtml({
      organizationName: 'Demo Org',
      facilityName: 'KIZAD Plant',
      reportingYear: 2026,
      inventory: [row],
      evidence: [
        {
          id: 'doc-1',
          filename: 'bill.pdf',
          sha256: 'abc',
          retentionUntil: '2031-01-01',
          sourceRefs: 'page 1',
        },
      ],
      methodology: 'Activity data multiplied by the selected factor.',
      changeLog: ['Initial confirmation'],
    });
    expect(html).toContain('Demo Org');
    expect(html).toContain('bill.pdf');
    expect(html).toContain('Initial confirmation');
  });
  it('does not claim official IEQT mapping before the template is supplied', () => {
    expect(IEQT_MAPPING_STATUS).toBe('PENDING_OFFICIAL_TEMPLATE');
  });
});
