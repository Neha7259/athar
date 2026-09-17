import type { Scope } from './enums.js';

/**
 * IPCC-aligned source categories used by the Source Register.
 * Codes follow IPCC 2006 Guidelines sector numbering where applicable;
 * scope-2 purchased energy categories use GHG Protocol style codes.
 */
export const IPCC_CATEGORIES = [
  'stationary_combustion', // 1.A.2 style — boilers, generators, furnaces
  'mobile_combustion', // 1.A.3 — owned fleet vehicles, forklifts
  'process_emissions', // 2.x — industrial processes
  'fugitive_refrigerants', // 2.F — refrigerant top-ups / leaks
  'purchased_electricity', // scope 2 — grid electricity (DEWA/ADDC/SEWA/FEWA)
  'purchased_cooling', // scope 2 — district cooling (Tabreed/Empower)
] as const;
export type IpccCategory = (typeof IPCC_CATEGORIES)[number];

export const IPCC_CATEGORY_META: Record<
  IpccCategory,
  { scope: Scope; labelEn: string; labelAr: string; ipccRef: string }
> = {
  stationary_combustion: {
    scope: 'scope1',
    labelEn: 'Stationary combustion',
    labelAr: 'الاحتراق الثابت',
    ipccRef: '1.A.2',
  },
  mobile_combustion: {
    scope: 'scope1',
    labelEn: 'Mobile combustion',
    labelAr: 'الاحتراق المتنقل',
    ipccRef: '1.A.3',
  },
  process_emissions: {
    scope: 'scope1',
    labelEn: 'Process emissions',
    labelAr: 'انبعاثات العمليات',
    ipccRef: '2',
  },
  fugitive_refrigerants: {
    scope: 'scope1',
    labelEn: 'Fugitive emissions (refrigerants)',
    labelAr: 'الانبعاثات الهاربة (غازات التبريد)',
    ipccRef: '2.F',
  },
  purchased_electricity: {
    scope: 'scope2',
    labelEn: 'Purchased electricity',
    labelAr: 'الكهرباء المشتراة',
    ipccRef: 'Scope 2 (location-based)',
  },
  purchased_cooling: {
    scope: 'scope2',
    labelEn: 'Purchased district cooling',
    labelAr: 'التبريد المشترى',
    ipccRef: 'Scope 2 (purchased cooling)',
  },
};

export function scopeOfCategory(cat: IpccCategory): Scope {
  return IPCC_CATEGORY_META[cat].scope;
}
