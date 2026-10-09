import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 configuration. The Rust-free client is generated into
 * `src/generated/prisma` and connects at runtime through the pg driver adapter
 * (see `PrismaService`). This file only drives the Prisma CLI.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
