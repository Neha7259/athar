import { describe, expect, it } from 'vitest';
import {
  calculateEmissions,
  calculateInventory,
  CalculationError,
  resolveFactor,
  type CalculationActivity,
  type CalculationFactor,
} from './index.js';

const electricityActivity: CalculationActivity = {
  id: 'activity-1',
  category: 'purchased_electricity',
  scope: 'scope2',
  quantity: 1500,
  unit: 'kWh',
  periodStart: '2026-01-01',
};
const electricityFactor: CalculationFactor = {
  id: 'factor-1',
  setCode: 'TEST-GRID-2026',
  category: 'purchased_electricity',
  fuelOrEnergyType: 'grid',
  unitIn: 'kWh',
  value: 0.0004,
  gwpSet: 'AR6',
  validFrom: '2026-01-01',
  provisional: true,
};

describe('calculateEmissions', () => {
  it('calculates and rounds tCO2e', () => {
    expect(calculateEmissions(electricityActivity, electricityFactor)).toEqual({
      activityId: 'activity-1',
      factorId: 'factor-1',
      normalizedQuantity: 1500,
      co2eTonnes: 0.6,
      calcVersion: '0.1.0',
    });
  });
  it('converts compatible units before calculating', () => {
    expect(
      calculateEmissions({ ...electricityActivity, quantity: 1.5, unit: 'MWh' }, electricityFactor)
        .co2eTonnes,
    ).toBe(0.6);
  });
  it('rejects category mismatch', () => {
    expect(() =>
      calculateEmissions(
        { ...electricityActivity, category: 'stationary_combustion', scope: 'scope1' },
        electricityFactor,
      ),
    ).toThrow(CalculationError);
  });
  it('rejects invalid scope', () => {
    expect(() =>
      calculateEmissions({ ...electricityActivity, scope: 'scope1' }, electricityFactor),
    ).toThrow('scope');
  });
  it('rejects incompatible units', () => {
    expect(() =>
      calculateEmissions({ ...electricityActivity, unit: 'litre' }, electricityFactor),
    ).toThrow('convert');
  });
  it('rejects a factor outside its validity window', () => {
    expect(() =>
      calculateEmissions({ ...electricityActivity, periodStart: '2025-01-01' }, electricityFactor),
    ).toThrow('validity');
  });
});

describe('inventory and factor resolution', () => {
  it('calculates an inventory with a pinned version', () => {
    expect(
      calculateInventory([{ activity: electricityActivity, factor: electricityFactor }], '1.2.0')[0]
        ?.calcVersion,
    ).toBe('1.2.0');
  });
  it('resolves one valid factor', () => {
    expect(
      resolveFactor([electricityFactor], { ...electricityFactor, periodStart: '2026-02-01' }),
    ).toBe(electricityFactor);
  });
  it('rejects missing and ambiguous factors', () => {
    expect(() => resolveFactor([], { ...electricityFactor, periodStart: '2026-02-01' })).toThrow(
      'No valid',
    );
    expect(() =>
      resolveFactor([electricityFactor, { ...electricityFactor, id: 'factor-2' }], {
        ...electricityFactor,
        periodStart: '2026-02-01',
      }),
    ).toThrow('Multiple');
  });
});
