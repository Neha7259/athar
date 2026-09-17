/** Canonical activity-data units accepted by the ledger. */
export const UNITS = [
  'kWh',
  'MWh',
  'litre',
  'm3', // natural gas / sewage
  'kg',
  'tonne',
  'TR_hour', // district cooling ton-refrigeration hours
  'km',
  'GJ',
] as const;
export type Unit = (typeof UNITS)[number];

/** Simple scale conversions between compatible units (same dimension). */
const CONVERSIONS: Record<string, number> = {
  'MWh->kWh': 1000,
  'kWh->MWh': 0.001,
  'tonne->kg': 1000,
  'kg->tonne': 0.001,
};

export function isUnit(u: string): u is Unit {
  return (UNITS as readonly string[]).includes(u);
}

/**
 * Convert quantity between compatible units. Returns null when no conversion
 * path exists — callers must treat that as a hard error, never a fallback.
 */
export function convertUnit(quantity: number, from: Unit, to: Unit): number | null {
  if (from === to) return quantity;
  const factor = CONVERSIONS[`${from}->${to}`];
  return factor === undefined ? null : quantity * factor;
}
