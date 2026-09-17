import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

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
    expect(createFacility.json().facility.name).toBe('KIZAD Plant 1');

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
