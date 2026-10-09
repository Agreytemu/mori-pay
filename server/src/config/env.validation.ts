import { z } from 'zod';

/**
 * Runtime validation of environment variables. If any value is missing or
 * malformed the process exits before the app starts — no silent misconfig.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_NAME: z.string().default('Mori Pay API'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().default('*'),

  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me-32chars'),
  JWT_REFRESH_SECRET: z.string().min(16).default('dev-refresh-secret-change-me-32chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  STAKABA_BASE_URL: z.string().url().default('https://api.stakaba.com'),
  STAKABA_API_KEY: z.string().default(''),
  STAKABA_WEBHOOK_SECRET: z.string().optional(),

  SMS_PROVIDER: z.enum(['console', 'beem', 'nextsms']).default('console'),
  SMS_API_KEY: z.string().optional(),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return result.data;
}
