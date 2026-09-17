import type { IpccCategory } from '@athar/shared';

export interface ReductionSource {
  sourceId: string;
  category: IpccCategory;
  fuelOrEnergyType: string;
  annualTco2e: number;
}

export interface ReductionMeasure {
  sourceId: string;
  title: string;
  rationale: string;
  estimatedTco2ePerYear: number;
  estimateBasis: string;
  capexAedRange: { min: number; max: number };
  status: 'proposed';
}

export function suggestReductionMeasures(sources: readonly ReductionSource[]): ReductionMeasure[] {
  return sources.flatMap((source) => {
    const percentage = (
      low: number,
      high: number,
      title: string,
      rationale: string,
      capexMin: number,
      capexMax: number,
      basis: string,
    ): ReductionMeasure => ({
      sourceId: source.sourceId,
      title,
      rationale,
      estimatedTco2ePerYear: Number((source.annualTco2e * ((low + high) / 2)).toFixed(2)),
      estimateBasis: `${basis}; range ${Math.round(low * 100)}%-${Math.round(high * 100)}% of source emissions`,
      capexAedRange: { min: capexMin, max: capexMax },
      status: 'proposed',
    });
    switch (source.category) {
      case 'purchased_electricity':
        return [
          percentage(
            0.08,
            0.18,
            'Facility energy-efficiency programme',
            'Reduce avoidable consumption through motors, compressed air, HVAC, and controls.',
            50000,
            500000,
            'Sector-neutral screening estimate',
          ),
          percentage(
            0.15,
            0.35,
            'On-site solar feasibility study',
            'Displace a portion of grid electricity with verified on-site generation.',
            250000,
            2500000,
            'Screening estimate; requires engineering feasibility',
          ),
        ];
      case 'purchased_cooling':
        return [
          percentage(
            0.05,
            0.15,
            'Cooling optimisation programme',
            'Tune setpoints, controls, and maintenance to reduce district cooling demand.',
            25000,
            250000,
            'Screening estimate',
          ),
        ];
      case 'stationary_combustion':
        return [
          percentage(
            0.05,
            0.12,
            'Combustion efficiency review',
            'Reduce fuel use through burner tuning, maintenance, and heat recovery.',
            40000,
            400000,
            'Screening estimate',
          ),
        ];
      case 'mobile_combustion':
        return [
          percentage(
            0.05,
            0.2,
            'Fleet efficiency programme',
            'Reduce fuel use through routing, driver training, maintenance, and vehicle replacement.',
            10000,
            750000,
            'Screening estimate',
          ),
        ];
      case 'fugitive_refrigerants':
        return [
          percentage(
            0.1,
            0.3,
            'Refrigerant leak detection programme',
            'Reduce fugitive losses through inspection, repair, and refrigerant management.',
            15000,
            180000,
            'Screening estimate',
          ),
        ];
      case 'process_emissions':
        return [
          percentage(
            0.03,
            0.1,
            'Process optimisation study',
            'Identify material and process changes that lower direct process emissions.',
            50000,
            1000000,
            'Requires sector engineering assessment',
          ),
        ];
    }
  });
}
