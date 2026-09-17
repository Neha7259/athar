import { createDb } from '@athar/db';

const defaultUrl = 'postgres://athar:athar_dev@localhost:5432/athar';

let db: ReturnType<typeof createDb> | undefined;

export function getDb() {
  db ??= createDb(process.env.DATABASE_URL ?? defaultUrl);
  return db;
}
