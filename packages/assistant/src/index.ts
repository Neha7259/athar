import type { IpccCategory, Scope, Unit } from '@athar/shared';

export interface SourceDraft {
  ipccCategory: IpccCategory;
  scope: Scope;
  fuelOrEnergyType: string;
  unit: Unit;
  description: string;
}

export interface SourceAssistantResult {
  message: string;
  draft?: SourceDraft;
  confidence: number;
  needsConfirmation: true;
  questions: string[];
}

const patterns: ReadonlyArray<{ pattern: RegExp; draft: SourceDraft; message: string }> = [
  {
    pattern: /electric|dewa|addc|sewa|feiwa|grid|كهرباء|ديوا|كهربائي/iu,
    draft: { ipccCategory: 'purchased_electricity', scope: 'scope2', fuelOrEnergyType: 'grid_electricity', unit: 'kWh', description: 'Purchased electricity from the utility grid' },
    message: 'This sounds like purchased grid electricity.',
  },
  {
    pattern: /diesel|petrol|gasoline|fuel|ديزل|وقود|بنزين/iu,
    draft: { ipccCategory: 'stationary_combustion', scope: 'scope1', fuelOrEnergyType: 'diesel', unit: 'litre', description: 'Fuel consumed in stationary equipment' },
    message: 'This sounds like stationary fuel combustion.',
  },
  {
    pattern: /cooling|tabreed|empower|district|تبريد/iu,
    draft: { ipccCategory: 'purchased_cooling', scope: 'scope2', fuelOrEnergyType: 'district_cooling', unit: 'TR_hour', description: 'Purchased district cooling' },
    message: 'This sounds like purchased district cooling.',
  },
  {
    pattern: /refrigerant|r410|r32|غاز التبريد/iu,
    draft: { ipccCategory: 'fugitive_refrigerants', scope: 'scope1', fuelOrEnergyType: 'refrigerant', unit: 'kg', description: 'Refrigerant top-up or fugitive loss' },
    message: 'This sounds like fugitive refrigerant activity.',
  },
];

export function suggestSourceDraft(message: string): SourceAssistantResult {
  const match = patterns.find((candidate) => candidate.pattern.test(message));
  if (!match) {
    return {
      message: 'I could not confidently classify that source yet.',
      confidence: 0.2,
      needsConfirmation: true,
      questions: ['What fuel or energy is consumed?', 'Which unit appears on the bill or meter?', 'Is the equipment owned by the facility or purchased from a utility?'],
    };
  }
  return {
    message: match.message,
    draft: match.draft,
    confidence: 0.78,
    needsConfirmation: true,
    questions: ['Which facility should receive this source?', 'Does the unit match the bill or meter?', 'Please confirm this source before saving it.'],
  };
}
