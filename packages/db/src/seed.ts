import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as schema from './schema.js';

const scrypt = promisify(scryptCallback);

// Duplicated from apps/api/src/auth.ts (kept local so @athar/db has no
// dependency on the api app) — must stay encoding-compatible with it.
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

const DEMO_ORG_EMAIL = 'demo-owner@athar.example';
const DEMO_ORG_PASSWORD = 'athar-demo-password-2026';

async function main() {
  const url = process.env.DATABASE_URL ?? 'postgres://athar:athar_dev@localhost:5432/athar';
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });

  const [existingUser] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, DEMO_ORG_EMAIL));

  if (existingUser) {
    console.log('Seed data already present — skipping.');
    await client.end();
    return;
  }

  await db.transaction(async (tx) => {
    const [organization] = await tx
      .insert(schema.organizations)
      .values({
        nameEn: 'Athar Demo Manufacturing',
        nameAr: 'أثر للتصنيع (تجريبي)',
        emirate: 'abu_dhabi',
        hceeFlag: false,
      })
      .returning();
    if (!organization) throw new Error('Failed to seed demo organization');

    const [facility] = await tx
      .insert(schema.facilities)
      .values({
        orgId: organization.id,
        name: 'KIZAD Plant 1',
        emirate: 'abu_dhabi',
        jurisdictions: ['MOCCAE', 'EAD'],
        sector: 'manufacturing',
      })
      .returning();
    if (!facility) throw new Error('Failed to seed demo facility');

    const [user] = await tx
      .insert(schema.users)
      .values({
        email: DEMO_ORG_EMAIL,
        passwordHash: await hashPassword(DEMO_ORG_PASSWORD),
        displayName: 'Demo Owner',
      })
      .returning();
    if (!user) throw new Error('Failed to seed demo user');

    await tx.insert(schema.memberships).values({
      orgId: organization.id,
      userId: user.id,
      role: 'owner',
    });
  });

  console.log(`Seeded demo org/facility/owner (login: ${DEMO_ORG_EMAIL} / ${DEMO_ORG_PASSWORD}).`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
