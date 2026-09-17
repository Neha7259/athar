import { describe, expect, it } from 'vitest';
import { suggestReductionMeasures } from './index.js';

describe('reduction plan suggestions', () => {
  it('suggests source-specific measures with explicit estimates', () => {
    const measures = suggestReductionMeasures([
      {
        sourceId: 'electricity',
        category: 'purchased_electricity',
        fuelOrEnergyType: 'grid',
        annualTco2e: 1000,
      },
      {
        sourceId: 'diesel',
        category: 'stationary_combustion',
        fuelOrEnergyType: 'diesel',
        annualTco2e: 100,
      },
    ]);
    expect(measures).toHaveLength(3);
    expect(measures[0]?.estimatedTco2ePerYear).toBeGreaterThan(0);
    expect(measures.every((measure) => measure.status === 'proposed')).toBe(true);
    expect(measures.every((measure) => measure.estimateBasis.includes('estimate'))).toBe(true);
  });
});
