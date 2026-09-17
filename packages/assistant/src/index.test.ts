import { describe, expect, it } from 'vitest';
import { suggestSourceDraft } from './index.js';

describe('source register assistant fallback', () => {
  it('recognizes English and Arabic electricity prompts', () => {
    expect(suggestSourceDraft('Our DEWA electricity bill is monthly').draft?.scope).toBe('scope2');
    expect(suggestSourceDraft('فاتورة كهرباء شهرية').draft?.ipccCategory).toBe('purchased_electricity');
  });
  it('always requires human confirmation', () => {
    const result = suggestSourceDraft('diesel generator fuel');
    expect(result.needsConfirmation).toBe(true);
    expect(result.confidence).toBeLessThan(1);
  });
  it('asks clarifying questions for unknown sources', () => {
    expect(suggestSourceDraft('something unusual').questions.length).toBeGreaterThan(0);
  });
});
