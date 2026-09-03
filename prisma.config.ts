/**
 * Prisma CLI configuration.
 *
 * Replaces the `prisma` key in package.json, which Prisma 6 deprecates and
 * Prisma 7 removes.
 *
 * The `dotenv` import is load-bearing, not decoration. The moment this file
 * exists the CLI announces "Prisma config detected, skipping environment
 * variable loading" and stops reading `.env` itself — so without this, every
 * `migrate`/`seed`/`validate` run fails with P1012 on the `DATABASE_URL` and
 * `DIRECT_URL` the datasource block requires. It must come first, before
 * anything reads `process.env`.
 *
 * Only `.env` is loaded, which is exactly what the CLI used to read on its own
 * (`.env.local` is Next's convention and was never visible to Prisma). dotenv
 * does not overwrite variables that are already set, so CI — which exports them
 * directly in the workflow — is unaffected.
 */
import 'dotenv/config'

import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
})
