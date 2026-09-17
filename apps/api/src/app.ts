import Fastify, { type FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { z } from 'zod';
import { calculateEmissions, resolveFactor, type CalculationActivity } from '@athar/calc';
import {
  emissionSources as emissionSourcesTable,
  evidenceDocuments as evidenceDocumentsTable,
  facilities as facilitiesTable,
  memberships,
  organizations as organizationsTable,
  users as usersTable,
} from '@athar/db';
import { provisionalFactors } from '@athar/factors';
import { runDataQualityChecks, type QualityActivity } from '@athar/dq';
import { suggestReductionMeasures, type ReductionSource } from '@athar/reduction';
import { eq, inArray } from 'drizzle-orm';
import { hashPassword, verifyPassword, type AuthUser } from './auth.js';
import { invitations } from './store.js';
import { persistEvidence } from './storage.js';
import { getDb } from './database.js';

const emirates = [
  'abu_dhabi',
  'dubai',
  'sharjah',
  'ajman',
  'umm_al_quwain',
  'ras_al_khaimah',
  'fujairah',
] as const;

const registerSchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  organizationNameAr: z.string().trim().max(160).optional(),
  tradeLicenseNo: z.string().trim().max(80).optional(),
  emirate: z.enum(emirates),
  email: z.string().trim().email(),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(2).max(120),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const facilitySchema = z.object({
  name: z.string().trim().min(2).max(160),
  emirate: z.enum(emirates),
  sector: z.string().trim().max(120).optional(),
  jurisdictions: z
    .array(z.enum(['MOCCAE', 'EAD']))
    .min(1)
    .default(['MOCCAE']),
});

const invitationSchema = z.object({
  email: z.string().trim().email(),
  displayName: z.string().trim().min(2).max(120),
  role: z.enum(['admin', 'data_provider', 'validator', 'verifier_readonly']),
});

const sourceSchema = z.object({
  facilityId: z.string().uuid(),
  ipccCategory: z.enum([
    'stationary_combustion',
    'mobile_combustion',
    'process_emissions',
    'fugitive_refrigerants',
    'purchased_electricity',
    'purchased_cooling',
  ]),
  scope: z.enum(['scope1', 'scope2']),
  fuelOrEnergyType: z.string().trim().min(2).max(120),
  unit: z.enum(['kWh', 'MWh', 'litre', 'm3', 'kg', 'tonne', 'TR_hour', 'km', 'GJ']),
  description: z.string().trim().max(500).optional(),
});

const evidenceDocTypes = [
  'utility_bill',
  'fuel_invoice',
  'cooling_invoice',
  'refrigerant_log',
  'fleet_statement',
  'meter_log',
  'other',
] as const;

const calculationSchema = z.object({
  id: z.string().min(1),
  category: sourceSchema.shape.ipccCategory,
  scope: z.enum(['scope1', 'scope2']),
  quantity: z.number().finite().nonnegative(),
  unit: sourceSchema.shape.unit,
  periodStart: z.string().date(),
  fuelOrEnergyType: z.string().trim().min(2).max(120),
  gwpSet: z.enum(['AR5', 'AR6']),
});

const dqSchema = z.object({
  reportingYear: z.number().int().min(2020).max(2100),
  entries: z.array(
    z.object({
      id: z.string().min(1),
      sourceId: z.string().min(1),
      periodStart: z.string().date(),
      quantity: z.number().finite().nonnegative(),
      unit: sourceSchema.shape.unit,
      evidenceDocumentId: z.string().min(1).optional(),
      documentSha256: z.string().min(1).optional(),
    }),
  ),
});

const reductionSchema = z.object({
  sources: z.array(z.object({
    sourceId: z.string().min(1),
    category: sourceSchema.shape.ipccCategory,
    fuelOrEnergyType: z.string().min(1),
    annualTco2e: z.number().finite().nonnegative(),
  })),
});

function currentUser(request: { user: unknown }): AuthUser {
  return request.user as AuthUser;
}

function canManageFacilities(user: AuthUser): boolean {
  return ['owner', 'admin'].includes(user.role);
}

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'athar-local-development-secret-change-me',
  });
  await app.register(multipart, { limits: { fileSize: 25 * 1024 * 1024, files: 1 } });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Athar API',
        description: 'Audit-grade emissions ledger for UAE MRV',
        version: '0.1.0',
      },
    },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.get(
    '/health',
    {
      schema: {
        response: {
          200: z.object({
            status: z.literal('ok'),
            version: z.string(),
            time: z.string(),
          }),
        },
      },
    },
    async () => ({
      status: 'ok' as const,
      version: '0.1.0',
      time: new Date().toISOString(),
    }),
  );

  app.decorate('authenticate', async (request) => {
    await request.jwtVerify();
  });

  app.post('/auth/register', { schema: { body: registerSchema } }, async (request, reply) => {
    const input = request.body;
    const email = input.email.toLowerCase();
    const db = getDb();
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.email, email));
    if (existing.length > 0) {
      return reply.code(409).send({ message: 'An account with this email already exists' });
    }

    const passwordHash = await hashPassword(input.password);
    const result = await db.transaction(async (tx) => {
      const [organization] = await tx
        .insert(organizationsTable)
        .values({
          nameEn: input.organizationName,
          ...(input.organizationNameAr ? { nameAr: input.organizationNameAr } : {}),
          ...(input.tradeLicenseNo ? { tradeLicenseNo: input.tradeLicenseNo } : {}),
          emirate: input.emirate,
          hceeFlag: false,
        })
        .returning();
      if (!organization) throw new Error('Organization creation failed');
      const [user] = await tx
        .insert(usersTable)
        .values({ email, displayName: input.displayName, passwordHash })
        .returning();
      if (!user) throw new Error('User creation failed');
      await tx
        .insert(memberships)
        .values({ orgId: organization.id, userId: user.id, role: 'owner' });
      return { organization, user };
    });
    const publicUser: AuthUser = {
      id: result.user.id,
      email: result.user.email,
      displayName: result.user.displayName,
      role: 'owner',
      orgId: result.organization.id,
    };
    const token = await reply.jwtSign(publicUser, { expiresIn: '8h' });
    return reply.code(201).send({ user: publicUser, token });
  });

  app.post('/auth/login', { schema: { body: loginSchema } }, async (request, reply) => {
    const input = request.body;
    const db = getDb();
    const [record] = await db
      .select({ user: usersTable, orgId: memberships.orgId, role: memberships.role })
      .from(usersTable)
      .innerJoin(memberships, eq(memberships.userId, usersTable.id))
      .where(eq(usersTable.email, input.email.toLowerCase()));
    if (
      !record ||
      !record.user.passwordHash ||
      !(await verifyPassword(input.password, record.user.passwordHash))
    ) {
      return reply.code(401).send({ message: 'Invalid email or password' });
    }
    const publicUser: AuthUser = {
      id: record.user.id,
      email: record.user.email,
      displayName: record.user.displayName,
      role: record.role,
      orgId: record.orgId,
    };
    const token = await reply.jwtSign(publicUser, { expiresIn: '8h' });
    return { user: publicUser, token };
  });

  app.get('/auth/me', { onRequest: [app.authenticate] }, async (request) => ({
    user: currentUser(request),
  }));

  app.get('/organizations/me', { onRequest: [app.authenticate] }, async (request, reply) => {
    const [organization] = await getDb()
      .select()
      .from(organizationsTable)
      .where(eq(organizationsTable.id, currentUser(request).orgId));
    if (!organization) return reply.code(404).send({ message: 'Organization not found' });
    return { organization };
  });

  app.get('/facilities', { onRequest: [app.authenticate] }, async (request) => {
    const user = currentUser(request);
    return {
      facilities: await getDb()
        .select()
        .from(facilitiesTable)
        .where(eq(facilitiesTable.orgId, user.orgId)),
    };
  });

  app.post(
    '/facilities',
    { onRequest: [app.authenticate], schema: { body: facilitySchema } },
    async (request, reply) => {
      const user = currentUser(request);
      if (!canManageFacilities(user))
        return reply.code(403).send({ message: 'Admin role required' });
      const [facility] = await getDb()
        .insert(facilitiesTable)
        .values({
          name: request.body.name,
          emirate: request.body.emirate,
          jurisdictions: request.body.jurisdictions,
          ...(request.body.sector ? { sector: request.body.sector } : {}),
          orgId: user.orgId,
        })
        .returning();
      if (!facility) return reply.code(500).send({ message: 'Facility creation failed' });
      return reply.code(201).send({ facility });
    },
  );

  app.post(
    '/members/invitations',
    { onRequest: [app.authenticate], schema: { body: invitationSchema } },
    async (request, reply) => {
      const user = currentUser(request);
      if (!canManageFacilities(user))
        return reply.code(403).send({ message: 'Admin role required' });
      const invitation = {
        id: randomUUID(),
        orgId: user.orgId,
        email: request.body.email.toLowerCase(),
        displayName: request.body.displayName,
        role: request.body.role,
        token: randomUUID(),
        createdAt: new Date().toISOString(),
      };
      invitations.set(invitation.id, invitation);
      return reply.code(201).send({ invitation });
    },
  );

  app.get('/members/invitations', { onRequest: [app.authenticate] }, async (request, reply) => {
    const user = currentUser(request);
    if (!canManageFacilities(user)) return reply.code(403).send({ message: 'Admin role required' });
    return {
      invitations: [...invitations.values()].filter((invite) => invite.orgId === user.orgId),
    };
  });

  app.get('/sources', { onRequest: [app.authenticate] }, async (request) => {
    const user = currentUser(request);
    const orgFacilities = await getDb()
      .select({ id: facilitiesTable.id })
      .from(facilitiesTable)
      .where(eq(facilitiesTable.orgId, user.orgId));
    const facilityIds = orgFacilities.map((facility) => facility.id);
    if (facilityIds.length === 0) return { sources: [] };
    return {
      sources: await getDb()
        .select()
        .from(emissionSourcesTable)
        .where(inArray(emissionSourcesTable.facilityId, facilityIds)),
    };
  });

  app.post(
    '/sources',
    { onRequest: [app.authenticate], schema: { body: sourceSchema } },
    async (request, reply) => {
      const user = currentUser(request);
      const [facility] = await getDb()
        .select({ id: facilitiesTable.id, orgId: facilitiesTable.orgId })
        .from(facilitiesTable)
        .where(eq(facilitiesTable.id, request.body.facilityId));
      if (!facility || facility.orgId !== user.orgId)
        return reply.code(404).send({ message: 'Facility not found' });
      if (!['owner', 'admin', 'data_provider'].includes(user.role)) {
        return reply.code(403).send({ message: 'Data provider role required' });
      }
      const [source] = await getDb()
        .insert(emissionSourcesTable)
        .values({
          facilityId: request.body.facilityId,
          ipccCategory: request.body.ipccCategory,
          scope: request.body.scope,
          fuelOrEnergyType: request.body.fuelOrEnergyType,
          unit: request.body.unit,
          ...(request.body.description ? { description: request.body.description } : {}),
          isActive: true,
        })
        .returning();
      if (!source) return reply.code(500).send({ message: 'Source creation failed' });
      return reply.code(201).send({ source });
    },
  );

  app.get('/evidence', { onRequest: [app.authenticate] }, async (request) => {
    const user = currentUser(request);
    return {
      documents: await getDb()
        .select()
        .from(evidenceDocumentsTable)
        .where(eq(evidenceDocumentsTable.orgId, user.orgId)),
    };
  });

  app.post(
    '/calculations/preview',
    { onRequest: [app.authenticate], schema: { body: calculationSchema } },
    async (request, reply) => {
      const input = request.body;
      try {
        const factor = resolveFactor(provisionalFactors, {
          category: input.category,
          fuelOrEnergyType: input.fuelOrEnergyType,
          unitIn: input.unit,
          gwpSet: input.gwpSet,
          periodStart: input.periodStart,
        });
        const activity: CalculationActivity = {
          id: input.id,
          category: input.category,
          scope: input.scope,
          quantity: input.quantity,
          unit: input.unit,
          periodStart: input.periodStart,
        };
        return { calculation: calculateEmissions(activity, factor), factor };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Calculation failed';
        return reply.code(422).send({ message });
      }
    },
  );

  app.post(
    '/dq/preview',
    { onRequest: [app.authenticate], schema: { body: dqSchema } },
    async (request) => ({
      flags: runDataQualityChecks(request.body.entries as QualityActivity[], {
        reportingYear: request.body.reportingYear,
      }),
    }),
  );

  app.post(
    '/reduction/preview',
    { onRequest: [app.authenticate], schema: { body: reductionSchema } },
    async (request) => ({
      measures: suggestReductionMeasures(request.body.sources as ReductionSource[]),
    }),
  );

  app.post('/evidence', { onRequest: [app.authenticate] }, async (request, reply) => {
    const user = currentUser(request);
    const file = await request.file();
    if (!file) return reply.code(400).send({ message: 'A file is required' });
    const buffer = await file.toBuffer();
    const docTypeField = file.fields.docType;
    const ocrLangField = file.fields.ocrLang;
    const docTypeValue =
      docTypeField &&
      !Array.isArray(docTypeField) &&
      'value' in docTypeField &&
      typeof docTypeField.value === 'string'
        ? docTypeField.value
        : 'other';
    const ocrLangValue =
      ocrLangField &&
      !Array.isArray(ocrLangField) &&
      'value' in ocrLangField &&
      typeof ocrLangField.value === 'string'
        ? ocrLangField.value
        : undefined;
    const docType = z.enum(evidenceDocTypes).safeParse(docTypeValue);
    const ocrLang = z.enum(['ar', 'en', 'mixed']).safeParse(ocrLangValue);
    if (!docType.success || (ocrLangValue && !ocrLang.success)) {
      return reply.code(400).send({ message: 'Invalid document type or OCR language' });
    }
    const persisted = await persistEvidence(buffer, file.filename);
    const uploadedAt = new Date();
    const retentionUntil = new Date(uploadedAt);
    retentionUntil.setFullYear(retentionUntil.getFullYear() + 5);
    const [document] = await getDb()
      .insert(evidenceDocumentsTable)
      .values({
        orgId: user.orgId,
        ...persisted,
        mime: file.mimetype,
        docType: docType.data,
        originalFilename: file.filename,
        uploadedBy: user.id,
        uploadedAt,
        retentionUntil: retentionUntil.toISOString().slice(0, 10),
        ...(ocrLang.data ? { ocrLang: ocrLang.data } : {}),
      })
      .returning();
    if (!document) return reply.code(500).send({ message: 'Evidence metadata creation failed' });
    return reply.code(201).send({ document });
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
  }
}
