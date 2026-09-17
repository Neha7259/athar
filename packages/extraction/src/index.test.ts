import { describe, expect, it } from 'vitest';
import {
  classifyDocument,
  extractFromDocument,
  ExtractionError,
  fieldUnit,
  redactPii,
} from './index.js';

describe('document classification and guardrails', () => {
  it('classifies common UAE evidence names', () => {
    expect(classifyDocument('ADDC fuel invoice.pdf', 'application/pdf').docType).toBe(
      'fuel_invoice',
    );
    expect(classifyDocument('meter.csv', 'text/csv').docType).toBe('meter_log');
  });
  it('redacts email, UAE phone, and ID-like values before model calls', () => {
    const safe = redactPii('Contact jane@example.com or +971 50 123 4567, ID 784-123456789012');
    expect(safe).not.toContain('jane@example.com');
    expect(safe).not.toContain('+971');
    expect(safe).toContain('[REDACTED_ID]');
  });
});

describe('structured extraction', () => {
  it('validates model output and preserves source references', async () => {
    const result = await extractFromDocument(
      {
        file: Buffer.from('bill'),
        filename: 'bill.pdf',
        mime: 'application/pdf',
        docType: 'utility_bill',
      },
      {
        complete: async () =>
          JSON.stringify({
            docType: 'utility_bill',
            language: 'mixed',
            confidence: 0.93,
            periodStart: '2026-01-01',
            periodEnd: '2026-01-31',
            fields: [
              {
                name: 'electricity',
                value: 1500,
                unit: 'kWh',
                confidence: 0.98,
                sourceRef: { page: 1, snippet: 'Total consumption 1,500 kWh' },
              },
            ],
          }),
      },
    );
    expect(result.fields[0]?.sourceRef.page).toBe(1);
    expect(fieldUnit(result.fields[0]!)).toBe('kWh');
  });
  it('rejects invalid model JSON and schema output', async () => {
    const request = {
      file: Buffer.from('bill'),
      filename: 'bill.pdf',
      mime: 'application/pdf',
      docType: 'utility_bill' as const,
    };
    await expect(
      extractFromDocument(request, { complete: async () => 'not json' }),
    ).rejects.toThrow(ExtractionError);
    await expect(
      extractFromDocument(request, { complete: async () => JSON.stringify({ fields: [] }) }),
    ).rejects.toThrow(ExtractionError);
  });
});
