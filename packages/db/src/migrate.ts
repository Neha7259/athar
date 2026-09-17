import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import path from 'path';

const url = process.env.DATABASE_URL ?? 'postgres://athar:athar_dev@localhost:5432/athar';

async function main() {
  const client = postgres(url, { max: 1 });
  await migrate(drizzle(client), {
    migrationsFolder: path.resolve(__dirname, '../drizzle'),
  });
  await client.end();
  console.log('migrations applied');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
