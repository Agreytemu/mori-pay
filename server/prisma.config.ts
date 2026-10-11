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
    // Client generation does not connect to a database. Keep installation
    // independent of server secrets, while requiring a URL for every other
    // Prisma command (including migrations).
    url:
      process.argv[2] === 'generate'
        ? process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL ?? ''
        : process.env.MIGRATE_DATABASE_URL ?? env('DATABASE_URL'),
  },
});
