import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 configuration. The Rust-free client is generated into
 * `src/generated/prisma` and connects at runtime through the pg driver adapter
 * (see `PrismaService`). This file only drives the Prisma CLI.
 *
 * Migrations use MIGRATE_DATABASE_URL when set. Supabase's transaction pooler
 * (port 6543) cannot acquire Postgres advisory locks that `prisma migrate`
 * needs, so point this at the session pooler (port 5432) or a direct
 * connection. Falls back to DATABASE_URL so local development keeps working.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // MIGRATE_DATABASE_URL is optional: use it (session pooler / direct) when
    // present, otherwise fall back to DATABASE_URL. Read it via process.env so a
    // missing value doesn't throw — Prisma's `env()` helper errors on absence,
    // which would break CI and hosts (e.g. Render) that only set DATABASE_URL.
    url: process.env.MIGRATE_DATABASE_URL ?? env('DATABASE_URL'),
  },
});
