import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { evidenceDocuments, organizations, users } from '@athar/db';
import { getDb } from '../database.js';
import { ExtractionJobError, runExtractionJob } from './extraction.js';

async function seedEvidenceDocument() {
  const db = getDb();
  const [organization] = await db
    .insert(organizations)
    .values({ nameEn: `Test Org ${randomUUID()}`, emirate: 'abu_dhabi', hceeFlag: false })
    .returning();
  if (!organization) throw new Error('setup failed');
  const [user] = await db
    .insert(users)
    .values({ email: `${randomUUID()}@example.com`, displayName: 'Test Uploader' })
    .returning();
  if (!user) throw new Error('setup failed');
  const [document] = await db
    .insert(evidenceDocuments)
    .values({
      orgId: organization.id,
      sha256: randomUUID().replace(/-/g, ''),
      storageKey: `${randomUUID()}.pdf`,
      mime: 'application/pdf',
      docType: 'other',
      originalFilename: 'bill.pdf',
      uploadedBy: user.id,
      retentionUntil: '2031-01-01',
    })
    .returning();
  if (!document) throw new Error('setup failed');
  return document;
}

const classificationCompletion = {
  complete: async () => JSON.stringify({ docType: 'utility_bill', language: 'en' }),
};

describe('runExtractionJob', () => {
  it('classifies, extracts, redacts, and persists a proposed extraction row', async () => {
    const document = await seedEvidenceDocument();
    const extraction = await runExtractionJob(
      {
        db: getDb(),
        readEvidence: async () => Buffer.from('fake bill bytes'),
        classificationCompletion,
        extractionCompletion: {
          complete: async () =>
            JSON.stringify({
              docType: 'utility_bill',
              language: 'en',
              confidence: 0.91,
              fields: [
                {
                  name: 'electricity',
                  value: 1200,
                  unit: 'kWh',
                  confidence: 0.95,
                  sourceRef: {
                    page: 1,
                    snippet: 'Contact billing@example.com for queries. Total: 1,200 kWh',
                  },
                },
              ],
            }),
        },
      },
      { evidenceDocumentId: document.id },
    );

    expect(extraction.documentId).toBe(document.id);
    expect(extraction.status).toBe('proposed');
    expect(extraction.promptVersion).toBe('v1');
    const raw = extraction.rawJson as { fields: { sourceRef: { snippet: string } }[] };
    expect(raw.fields[0]?.sourceRef.snippet).not.toContain('billing@example.com');

    // classification should have corrected the upload-time 'other' default
    const [updated] = await getDb()
      .select()
      .from(evidenceDocuments)
      .where(eq(evidenceDocuments.id, document.id));
    expect(updated?.docType).toBe('utility_bill');
  });

  it('throws when the evidence document does not exist', async () => {
    await expect(
      runExtractionJob(
        {
          db: getDb(),
          readEvidence: async () => Buffer.from(''),
          classificationCompletion,
          extractionCompletion: { complete: async () => '{}' },
        },
        { evidenceDocumentId: randomUUID() },
      ),
    ).rejects.toThrow(ExtractionJobError);
  });
});
