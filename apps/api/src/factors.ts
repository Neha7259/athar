import { eq } from 'drizzle-orm';
import { emissionFactors } from '@athar/db';
import type { CalculationFactor } from '@athar/calc';
import type { Queryable } from './database.js';

/**
 * emission_factors is the durable, FK-referenced record of a factor;
 * packages/factors currently ships a small hardcoded provisional array (see
 * projectBrief.md Decision Log — versioned JSON+loader is a later sprint).
 * This bridges the two: resolve the DB row for a resolved calc factor,
 * creating it on first use. Keyed on setCode, which is unique per factor
 * vintage/source (see emission_factors_set_code_uq).
 */
export async function resolveDbFactorId(db: Queryable, factor: CalculationFactor): Promise<string> {
  const [existing] = await db
    .select({ id: emissionFactors.id })
    .from(emissionFactors)
    .where(eq(emissionFactors.setCode, factor.setCode));
  if (existing) return existing.id;

  try {
    const [created] = await db
      .insert(emissionFactors)
      .values({
        setCode: factor.setCode,
        category: factor.category,
        fuelOrEnergyType: factor.fuelOrEnergyType,
        unitIn: factor.unitIn,
        value: factor.value.toString(),
        gwpSet: factor.gwpSet,
        validFrom: factor.validFrom,
        ...(factor.validTo ? { validTo: factor.validTo } : {}),
        ...(factor.sourceUrl ? { sourceUrl: factor.sourceUrl } : {}),
      })
      .returning({ id: emissionFactors.id });
    if (!created) throw new Error('Failed to persist emission factor');
    return created.id;
  } catch (error) {
    // Unique violation on setCode — another concurrent request created it
    // first; re-select rather than fail the whole confirmation.
    if ((error as { code?: string }).code === '23505') {
      const [row] = await db
        .select({ id: emissionFactors.id })
        .from(emissionFactors)
        .where(eq(emissionFactors.setCode, factor.setCode));
      if (row) return row.id;
    }
    throw error;
  }
}
