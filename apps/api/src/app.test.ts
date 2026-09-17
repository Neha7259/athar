import { describe, expect, it } from 'vitest';
import formAutoContentModule from 'form-auto-content';
import { buildApp } from './app.js';

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

    const multipart = formAutoContent({
      file: {
        value: Buffer.from('synthetic electricity bill'),
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
