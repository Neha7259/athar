import { sql } from 'drizzle-orm';
import { createDb, type Db } from '@athar/db';

// The API must connect as the restricted `athar_app` role (created by
// packages/db/drizzle/0000_initial_schema.sql), not the database owner —
// only that role has the append-only grants (INSERT/SELECT only) on
// ledger_entries and audit_log. Migrations still run as the owner via
// DATABASE_URL (see packages/db/src/migrate.ts).
const defaultUrl = 'postgres://athar_app:athar_app_dev@localhost:5432/athar';

let db: ReturnType<typeof createDb> | undefined;

export function getDb() {
  db ??= createDb(process.env.APP_DATABASE_URL ?? defaultUrl);
  return db;
}

export type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0];

// A route handler passes either getDb() or a withOrgScope transaction to
// the same query-building code; both support select/insert/update/delete.
export type Queryable = Db | Transaction;

/**
 * Row-level security (packages/db/drizzle/0003_row_level_security.sql) is
 * the DB-level backstop for multi-tenancy — the app-code `WHERE org_id = …`
 * filters throughout app.ts are defense in depth, not the only guard. RLS
 * policies read the `app.current_org_id` session setting, which only
 * exists inside a transaction started here; every route touching an
 * org-scoped table must run its queries through this helper. `users`,
 * `organizations`, and `memberships` are deliberately NOT row-level
 * secured — auth (login/register) must resolve a user's org before an org
 * context exists, so those three stay app-code enforced.
 */
export async function withOrgScope<T>(
  orgId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.current_org_id', ${orgId}, true)`);
    return fn(tx);
  });
}
