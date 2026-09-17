import type { CalculationFactor } from '@athar/calc';

/**
 * Provisional demo factors only. They are deliberately marked provisional until
 * official UAE values and vintage are confirmed in docs/REG_QUESTIONS.md.
 */
export const provisionalFactors: readonly CalculationFactor[] = [
  {
    id: 'provisional-uae-grid-dxb-2025',
    setCode: 'UAE-GRID-DXB-2025-PROVISIONAL',
    category: 'purchased_electricity',
    fuelOrEnergyType: 'grid_electricity_dubai',
    unitIn: 'kWh',
    value: 0.0004,
    gwpSet: 'AR6',
    validFrom: '2025-01-01',
    provisional: true,
  },
  {
    id: 'provisional-diesel-2025',
    setCode: 'DEFRA-2025-PROVISIONAL',
    category: 'stationary_combustion',
    fuelOrEnergyType: 'diesel',
    unitIn: 'litre',
    value: 0.00268,
    gwpSet: 'AR6',
    validFrom: '2025-01-01',
    provisional: true,
  },
];

export { resolveFactor } from '@athar/calc';
