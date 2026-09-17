import { auditLog } from '@athar/db';
import type { Queryable } from './database.js';

// Single designated writer for audit_log (see ledger.ts for the same rule).
export async function recordAudit(
  db: Queryable,
  entry: {
    actor: string;
    action: string;
    entity: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
  },
) {
  await db.insert(auditLog).values({
    actor: entry.actor,
    action: entry.action,
    entity: entry.entity,
    ...(entry.entityId ? { entityId: entry.entityId } : {}),
    ...(entry.before !== undefined ? { before: entry.before } : {}),
    ...(entry.after !== undefined ? { after: entry.after } : {}),
  });
}
