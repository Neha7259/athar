-- =====================================================================
-- Migration 0001: unique index on emission_factors.set_code
-- Written manually (drizzle-kit generate cannot resolve this ESM
-- monorepo's schema.ts — see note on migration 0000). Needed so the
-- extraction-confirmation flow can safely resolve-or-create a factor
-- row by setCode without racing duplicate inserts.
-- =====================================================================

CREATE UNIQUE INDEX "emission_factors_set_code_uq" ON "emission_factors" ("set_code");
