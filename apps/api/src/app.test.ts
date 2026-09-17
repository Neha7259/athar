import { describe, expect, it } from 'vitest';
import formAutoContentModule from 'form-auto-content';
import { extractions } from '@athar/db';
import { buildApp } from './app.js';
import { getDb } from './database.js';

const formAutoContent = formAutoContentModule as unknown as (input: Record<string, unknown>) => {
  headers: Record<string, string>;
  payload: NodeJS.ReadableStream;
};

describe('health endpoint', () => {
  it('returns ok', async () => {
    const app = await buildApp();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.1.0');
    await app.close();
  });
});

describe('local auth and facility onboarding', () => {
  it('registers an owner, protects routes, and creates a facility', async () => {
    const app = await buildApp();
    const email = `neha-${Date.now()}@example.com`;
    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        organizationName: 'Athar Demo Manufacturing',
        emirate: 'abu_dhabi',
        email,
        password: 'correct-horse-battery-staple',
        displayName: 'Neha',
      },
    });

    expect(register.statusCode).toBe(201);
    const registration = register.json() as { token: string; user: { role: string } };
    expect(registration.user.role).toBe('owner');
    expect(registration.token).toEqual(expect.any(String));

    const unauthorized = await app.inject({ method: 'GET', url: '/facilities' });
    expect(unauthorized.statusCode).toBe(401);

    const createFacility = await app.inject({
      method: 'POST',
      url: '/facilities',
      headers: { authorization: `Bearer ${registration.token}` },
      payload: {
        name: 'KIZAD Plant 1',
        emirate: 'abu_dhabi',
        sector: 'manufacturing',
        jurisdictions: ['MOCCAE', 'EAD'],
      },
    });
    expect(createFacility.statusCode).toBe(201);
    const facilityId = createFacility.json().facility.id as string;
    expect(createFacility.json().facility.name).toBe('KIZAD Plant 1');

    const source = await app.inject({
      method: 'POST',
      url: '/sources',
      headers: { authorization: `Bearer ${registration.token}` },
      payload: {
        facilityId,
        ipccCategory: 'purchased_electricity',
        scope: 'scope2',
        fuelOrEnergyType: 'grid_electricity_abu_dhabi',
        unit: 'kWh',
      },
    });
    expect(source.statusCode).toBe(201);
    expect(source.json().source.ipccCategory).toBe('purchased_electricity');

    const calculation = await app.inject({
      method: 'POST',
      url: '/calculations/preview',
      headers: { authorization: `Bearer ${registration.token}` },
      payload: {
        id: 'activity-preview-1',
        category: 'purchased_electricity',
        scope: 'scope2',
        quantity: 1500,
        unit: 'kWh',
        periodStart: '2026-01-01',
        fuelOrEnergyType: 'grid_electricity_dubai',
        gwpSet: 'AR6',
      },
    });
    expect(calculation.statusCode).toBe(200);
    expect(calculation.json().calculation.co2eTonnes).toBe(0.6);
    expect(calculation.json().factor.provisional).toBe(true);

    const dq = await app.inject({
      method: 'POST',
      url: '/dq/preview',
      headers: { authorization: `Bearer ${registration.token}` },
      payload: {
        reportingYear: 2026,
        entries: [
          {
            id: 'entry-1',
            sourceId: 'source-1',
            periodStart: '2026-01-01',
            quantity: 10,
            unit: 'kWh',
          },
        ],
      },
    });
    expect(dq.statusCode).toBe(200);
    expect(dq.json().flags).toHaveLength(11);

    const reduction = await app.inject({
      method: 'POST',
      url: '/reduction/preview',
      headers: { authorization: `Bearer ${registration.token}` },
      payload: {
        sources: [
          {
            sourceId: 'source-1',
            category: 'purchased_electricity',
            fuelOrEnergyType: 'grid',
            annualTco2e: 1000,
          },
        ],
      },
    });
    expect(reduction.statusCode).toBe(200);
    expect(reduction.json().measures[0].status).toBe('proposed');

    const assistant = await app.inject({
      method: 'POST',
      url: '/source-assistant/preview',
      headers: { authorization: `Bearer ${registration.token}` },
      payload: { message: 'Our DEWA electricity bill is monthly' },
    });
    expect(assistant.statusCode).toBe(200);
    expect(assistant.json().draft.ipccCategory).toBe('purchased_electricity');
    expect(assistant.json().needsConfirmation).toBe(true);

    const multipart = formAutoContent({
      file: {
        value: Buffer.from(`synthetic electricity bill ${email}`),
        options: { filename: 'bill.pdf', contentType: 'application/pdf' },
      },
      docType: 'utility_bill',
      ocrLang: 'en',
    });
    const evidence = await app.inject({
      method: 'POST',
      url: '/evidence',
      headers: { authorization: `Bearer ${registration.token}`, ...multipart.headers },
      payload: multipart.payload,
    });
    expect(evidence.statusCode).toBe(201);
    expect(evidence.json().document.retentionUntil).toMatch(/^2031-/);

    const facilities = await app.inject({
      method: 'GET',
      url: '/facilities',
      headers: { authorization: `Bearer ${registration.token}` },
    });
    expect(facilities.statusCode).toBe(200);
    expect(facilities.json().facilities).toHaveLength(1);

    const invitation = await app.inject({
      method: 'POST',
      url: '/members/invitations',
      headers: { authorization: `Bearer ${registration.token}` },
      payload: {
        email: 'plant.manager@example.com',
        displayName: 'Plant Manager',
        role: 'data_provider',
      },
    });
    expect(invitation.statusCode).toBe(201);
    expect(invitation.json().invitation.role).toBe('data_provider');

    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'correct-horse-battery-staple' },
    });
    expect(login.statusCode).toBe(200);

    await app.close();
  });
});

describe('extraction review, confirmation, and the ledger', () => {
  it('confirms a proposed extraction into an activity entry and a ledger entry', async () => {
    const app = await buildApp();
    const email = `extraction-${Date.now()}@example.com`;
    const register = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        organizationName: 'Athar Extraction Test Co',
        emirate: 'dubai',
        email,
        password: 'correct-horse-battery-staple',
        displayName: 'Reviewer',
      },
    });
    const { token } = register.json() as { token: string };
    const auth = { authorization: `Bearer ${token}` };

    const facility = await app.inject({
      method: 'POST',
      url: '/facilities',
      headers: auth,
      payload: { name: 'DIC Plant', emirate: 'dubai', jurisdictions: ['MOCCAE'] },
    });
    const facilityId = facility.json().facility.id as string;

    const source = await app.inject({
      method: 'POST',
      url: '/sources',
      headers: auth,
      payload: {
        facilityId,
        ipccCategory: 'purchased_electricity',
        scope: 'scope2',
        fuelOrEnergyType: 'grid_electricity_dubai',
        unit: 'kWh',
      },
    });
    const sourceId = source.json().source.id as string;

    const multipart = formAutoContent({
      file: { value: Buffer.from(`bill ${email}`), options: { filename: 'bill.pdf' } },
      docType: 'utility_bill',
    });
    const evidence = await app.inject({
      method: 'POST',
      url: '/evidence',
      headers: { ...auth, ...multipart.headers },
      payload: multipart.payload,
    });
    const documentId = evidence.json().document.id as string;

    // Simulate what the worker's extraction processor would have written.
    const [proposed] = await getDb()
      .insert(extractions)
      .values({
        documentId,
        model: 'test-fixture',
        promptVersion: 'v1',
        rawJson: { fields: [{ name: 'electricity', value: 1000, unit: 'kWh' }] },
        confidence: '0.9',
        status: 'proposed',
      })
      .returning();
    if (!proposed) throw new Error('test setup failed');

    const list = await app.inject({
      method: 'GET',
      url: `/evidence/${documentId}/extractions`,
      headers: auth,
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().extractions).toHaveLength(1);

    const confirm = await app.inject({
      method: 'POST',
      url: `/extractions/${proposed.id}/confirm`,
      headers: auth,
      payload: {
        sourceId,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        quantity: 1000,
        unit: 'kWh',
        gwpSet: 'AR6',
      },
    });
    expect(confirm.statusCode).toBe(201);
    const confirmed = confirm.json() as {
      activityEntry: { id: string; extractionId: string };
      ledgerEntry: { id: string; co2eTonnes: string | number };
    };
    expect(confirmed.activityEntry.extractionId).toBe(proposed.id);
    expect(Number(confirmed.ledgerEntry.co2eTonnes)).toBe(0.4);

    const confirmAgain = await app.inject({
      method: 'POST',
      url: `/extractions/${proposed.id}/confirm`,
      headers: auth,
      payload: {
        sourceId,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        quantity: 1000,
        unit: 'kWh',
        gwpSet: 'AR6',
      },
    });
    expect(confirmAgain.statusCode).toBe(409);

    const ledger = await app.inject({ method: 'GET', url: '/ledger', headers: auth });
    expect(ledger.statusCode).toBe(200);
    expect(ledger.json().entries.map((e: { id: string }) => e.id)).toContain(
      confirmed.ledgerEntry.id,
    );

    const [secondProposed] = await getDb()
      .insert(extractions)
      .values({
        documentId,
        model: 'test-fixture',
        promptVersion: 'v1',
        rawJson: { fields: [] },
        confidence: '0.5',
        status: 'proposed',
      })
      .returning();
    if (!secondProposed) throw new Error('test setup failed');

    const reject = await app.inject({
      method: 'POST',
      url: `/extractions/${secondProposed.id}/reject`,
      headers: auth,
    });
    expect(reject.statusCode).toBe(200);
    expect(reject.json().extraction.status).toBe('rejected');

    const confirmRejected = await app.inject({
      method: 'POST',
      url: `/extractions/${secondProposed.id}/confirm`,
      headers: auth,
      payload: {
        sourceId,
        periodStart: '2026-01-01',
        periodEnd: '2026-01-31',
        quantity: 1,
        unit: 'kWh',
        gwpSet: 'AR6',
      },
    });
    expect(confirmRejected.statusCode).toBe(409);

    await app.close();
  });
});
