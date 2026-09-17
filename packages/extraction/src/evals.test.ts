import { describe, expect, it } from 'vitest';
import { extractionEvalCases } from './evals.js';

describe('extraction evaluation manifest', () => {
  it('contains 30 synthetic cases across five document types', () => {
    expect(extractionEvalCases).toHaveLength(30);
    expect(new Set(extractionEvalCases.map((item) => item.docType)).size).toBe(5);
    expect(extractionEvalCases.every((item) => item.expectedFieldNames.length > 0)).toBe(true);
  });
});
