import { describe, expect, it } from 'vitest';
import {
  ClassificationError,
  classifyDocument,
  extractFromDocument,
  ExtractionError,
  fieldUnit,
  redactPii,
} from './index.js';

describe('document classification and guardrails', () => {
  it('classifies a document from the model response, not the filename', async () => {
    const result = await classifyDocument(
      { file: Buffer.from('bytes'), filename: 'scan0001.pdf', mime: 'application/pdf' },
      { complete: async () => JSON.stringify({ docType: 'fuel_invoice', language: 'ar' }) },
    );
    expect(result.docType).toBe('fuel_invoice');
    expect(result.language).toBe('ar');
  });
  it('rejects invalid classification output', async () => {
    await expect(
      classifyDocument(
        { file: Buffer.from('bytes'), filename: 'x.pdf', mime: 'application/pdf' },
        { complete: async () => 'not json' },
      ),
    ).rejects.toThrow(ClassificationError);
    await expect(
      classifyDocument(
        { file: Buffer.from('bytes'), filename: 'x.pdf', mime: 'application/pdf' },
        { complete: async () => JSON.stringify({ docType: 'not_a_real_type', language: 'en' }) },
      ),
    ).rejects.toThrow(ClassificationError);
  });
  it('redacts email, UAE phone, and ID-like values', () => {
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
  it('redacts PII in returned snippets and values before the result leaves the module', async () => {
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
            language: 'en',
            confidence: 0.9,
            fields: [
              {
                name: 'account_holder_contact',
                value: 'jane@example.com',
                confidence: 0.8,
                sourceRef: {
                  page: 1,
                  snippet: 'Account holder: jane@example.com, +971 50 123 4567',
                },
              },
            ],
          }),
      },
    );
    expect(result.fields[0]?.value).toBe('[REDACTED_EMAIL]');
    expect(result.fields[0]?.sourceRef.snippet).not.toContain('jane@example.com');
    expect(result.fields[0]?.sourceRef.snippet).not.toContain('+971');
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
