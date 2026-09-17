import { ledgerEntries } from '@athar/db';
import type { LedgerCalculation } from '@athar/calc';
import type { Queryable } from './database.js';

// Single designated writer for ledger_entries (projectBrief.md working
// agreement: "Never write to ledger_entries or audit_log outside
// /packages/calc and the audit middleware"). Route handlers must call this
// rather than inserting into ledgerEntries directly.
export async function recordLedgerEntry(db: Queryable, calculation: LedgerCalculation) {
  const [entry] = await db
    .insert(ledgerEntries)
    .values({
      activityEntryId: calculation.activityId,
      factorId: calculation.factorId,
      co2eTonnes: calculation.co2eTonnes.toString(),
      calcVersion: calculation.calcVersion,
    })
    .returning();
  if (!entry) throw new Error('Failed to record ledger entry');
  return entry;
}
