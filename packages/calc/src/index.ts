import { convertUnit, type GwpSet, type IpccCategory, type Scope, type Unit } from '@athar/shared';

export interface CalculationActivity {
  id: string;
  category: IpccCategory;
  scope: Scope;
  quantity: number;
  unit: Unit;
  periodStart: string;
}

export interface CalculationFactor {
  id: string;
  setCode: string;
  category: IpccCategory;
  fuelOrEnergyType: string;
  unitIn: Unit;
  value: number;
  gwpSet: GwpSet;
  validFrom: string;
  validTo?: string;
  sourceUrl?: string;
  provisional: boolean;
}

export interface LedgerCalculation {
  activityId: string;
  factorId: string;
  normalizedQuantity: number;
  co2eTonnes: number;
  calcVersion: string;
}

export class CalculationError extends Error {}

function round(value: number, decimalPlaces: number): number {
  const scale = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function isFactorValidOn(factor: CalculationFactor, periodStart: string): boolean {
  return factor.validFrom <= periodStart && (!factor.validTo || periodStart <= factor.validTo);
}

export function calculateEmissions(
  activity: CalculationActivity,
  factor: CalculationFactor,
  calcVersion = '0.1.0',
): LedgerCalculation {
  if (activity.category !== factor.category) {
    throw new CalculationError('Activity category does not match emission factor category');
  }
  if (
    activity.scope !==
    (activity.category === 'purchased_electricity' || activity.category === 'purchased_cooling'
      ? 'scope2'
      : 'scope1')
  ) {
    throw new CalculationError('Activity scope does not match its IPCC category');
  }
  if (!isFactorValidOn(factor, activity.periodStart)) {
    throw new CalculationError('Emission factor is outside its validity window');
  }
  const normalizedQuantity = convertUnit(activity.quantity, activity.unit, factor.unitIn);
  if (normalizedQuantity === null) {
    throw new CalculationError(`Cannot convert ${activity.unit} to ${factor.unitIn}`);
  }
  return {
    activityId: activity.id,
    factorId: factor.id,
    normalizedQuantity,
    co2eTonnes: round(normalizedQuantity * factor.value, 6),
    calcVersion,
  };
}

export function calculateInventory(
  pairs: ReadonlyArray<{ activity: CalculationActivity; factor: CalculationFactor }>,
  calcVersion = '0.1.0',
): LedgerCalculation[] {
  return pairs.map(({ activity, factor }) => calculateEmissions(activity, factor, calcVersion));
}

export function resolveFactor(
  factors: ReadonlyArray<CalculationFactor>,
  input: Pick<CalculationFactor, 'category' | 'fuelOrEnergyType' | 'unitIn' | 'gwpSet'> & {
    periodStart: string;
  },
): CalculationFactor {
  const matches = factors.filter(
    (factor) =>
      factor.category === input.category &&
      factor.fuelOrEnergyType === input.fuelOrEnergyType &&
      factor.unitIn === input.unitIn &&
      factor.gwpSet === input.gwpSet &&
      isFactorValidOn(factor, input.periodStart),
  );
  if (matches.length === 0) throw new CalculationError('No valid emission factor found');
  if (matches.length > 1) throw new CalculationError('Multiple valid emission factors found');
  const match = matches[0];
  if (!match) throw new CalculationError('No valid emission factor found');
  return match;
}
