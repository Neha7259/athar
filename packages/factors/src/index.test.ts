import { describe, expect, it } from 'vitest';
import { provisionalFactors, resolveFactor } from './index.js';

describe('provisional factor library', () => {
  it('keeps demo factors explicitly provisional', () => {
    expect(provisionalFactors.length).toBeGreaterThan(0);
    expect(provisionalFactors.every((factor) => factor.provisional)).toBe(true);
  });
  it('resolves the Dubai grid factor by period and GWP', () => {
    const factor = provisionalFactors[0];
    expect(factor).toBeDefined();
    expect(
      resolveFactor(provisionalFactors, {
        category: 'purchased_electricity',
        fuelOrEnergyType: 'grid_electricity_dubai',
        unitIn: 'kWh',
        gwpSet: 'AR6',
        periodStart: '2026-01-01',
      }),
    ).toBe(factor);
  });
});
