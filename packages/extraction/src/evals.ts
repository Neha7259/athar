import type { DocType } from '@athar/shared';

export interface ExtractionEvalCase {
  id: string;
  filename: string;
  docType: DocType;
  language: 'ar' | 'en' | 'mixed';
  expectedFieldNames: readonly string[];
}

const cases: ExtractionEvalCase[] = [
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `utility-${index + 1}`,
    filename: `synthetic-utility-${index + 1}.pdf`,
    docType: 'utility_bill' as const,
    language: index % 2 === 0 ? ('mixed' as const) : ('en' as const),
    expectedFieldNames: ['billing_period', 'consumption', 'amount'],
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `fuel-${index + 1}`,
    filename: `synthetic-fuel-${index + 1}.pdf`,
    docType: 'fuel_invoice' as const,
    language: index % 2 === 0 ? ('en' as const) : ('mixed' as const),
    expectedFieldNames: ['invoice_date', 'fuel_type', 'quantity'],
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `cooling-${index + 1}`,
    filename: `synthetic-cooling-${index + 1}.pdf`,
    docType: 'cooling_invoice' as const,
    language: 'en' as const,
    expectedFieldNames: ['billing_period', 'tr_hours', 'amount'],
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `refrigerant-${index + 1}`,
    filename: `synthetic-refrigerant-${index + 1}.pdf`,
    docType: 'refrigerant_log' as const,
    language: index % 2 === 0 ? ('mixed' as const) : ('en' as const),
    expectedFieldNames: ['date', 'refrigerant_type', 'quantity'],
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `meter-${index + 1}`,
    filename: `synthetic-meter-${index + 1}.csv`,
    docType: 'meter_log' as const,
    language: 'en' as const,
    expectedFieldNames: ['period_start', 'period_end', 'quantity'],
  })),
];

export const extractionEvalCases: readonly ExtractionEvalCase[] = cases;
