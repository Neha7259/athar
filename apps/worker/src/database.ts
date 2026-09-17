import { createDb } from '@athar/db';

// Mirrors apps/api/src/database.ts — the worker also connects as the
// restricted `athar_app` role, never the DB owner.
const defaultUrl = 'postgres://athar_app:athar_app_dev@localhost:5432/athar';

let db: ReturnType<typeof createDb> | undefined;

export function getDb() {
  db ??= createDb(process.env.APP_DATABASE_URL ?? defaultUrl);
  return db;
}
