import { z } from 'zod';

/** Secrets shipped in `.env.example`; never acceptable in production. */
const DEV_JWT_DEFAULTS = new Set([
  'dev-access-secret-change-me-32chars',
  'dev-refresh-secret-change-me-32chars',
]);

/** Minimum entropy for access/refresh signing secrets in production. */
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * Runtime validation of environment variables. If any value is missing or
 * malformed the process exits before the app starts �?" no silent misconfig.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_NAME: z.string().default('Mori Pay API'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().url().optional(),
  CORS_ORIGINS: z.string().default('*'),

  JWT_ACCESS_SECRET: z.string().default('dev-access-secret-change-me-32chars'),
  JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret-change-me-32chars'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),

  /** Optional dedicated secret for receive-code QR signing; falls back to JWT. */
  RECEIVE_QR_SECRET: z.string().min(16).optional(),

  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),

  /** Per-tier outflow limits (whole TZS). See limits.config.ts for rationale. */
  LIMIT_STANDARD_DAILY: z.coerce.number().int().positive().default(1_000_000),
  LIMIT_STANDARD_PER_TX: z.coerce.number().int().positive().default(500_000),
  LIMIT_VERIFIED_DAILY: z.coerce.number().int().positive().default(5_000_000),
  LIMIT_VERIFIED_PER_TX: z.coerce.number().int().positive().default(3_000_000),

  ABLINER_BASE_URL: z.string().url().default('https://abliner.net'),
  ABLINER_API_KEY: z.string().default(''),
  /** Abliner Dashboard secret for deposit signing and webhook verification. */
  ABLINER_WEBHOOK_SECRET: z.string().trim().optional(),
  /** Public HTTPS endpoint Abliner POSTs transaction events to. */
  ABLINER_CALLBACK_URL: z
    .string()
    .default('https://moripay.up.railway.app/api/v1/webhooks/abliner'),
  /** Approved Abliner Sender ID for outbound SMS (optional). */
  ABLINER_SMS_SENDER_ID: z.string().optional(),

  /** Background settlement of gateway transactions whose webhook never arrived. */
  RECONCILIATION_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  RECONCILIATION_INTERVAL_SECONDS: z.coerce.number().int().positive().default(120),
  RECONCILIATION_STALE_SECONDS: z.coerce.number().int().positive().default(180),

  SMS_PROVIDER: z.enum(['console', 'abliner', 'beem', 'nextsms']).default('console'),
  SMS_API_KEY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  SMTP_HOST: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  SMTP_PORT: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.coerce.number().int().positive().optional(),
  ),
  SMTP_SECURE: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  ),
  SMTP_USER: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().trim().min(1).optional(),
  ),
  SMTP_PASS: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().min(1).optional(),
  ),

  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const normalized: Record<string, unknown> = { ...config };

  for (const [key, fallback] of [
    ['JWT_ACCESS_SECRET', 'dev-access-secret-change-me-32chars'],
    ['JWT_REFRESH_SECRET', 'dev-refresh-secret-change-me-32chars'],
  ] as const) {
    const value = normalized[key];
    if (typeof value === 'string' && value.trim() === '') {
      normalized[key] = fallback;
    }
  }

  const result = envSchema.safeParse(normalized);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  if (result.data.NODE_ENV === 'production') {
    const jwtProblems: string[] = [];
    const access = result.data.JWT_ACCESS_SECRET;
    const refresh = result.data.JWT_REFRESH_SECRET;

    for (const [key, value] of [
      ['JWT_ACCESS_SECRET', access],
      ['JWT_REFRESH_SECRET', refresh],
    ] as const) {
      if (!value || DEV_JWT_DEFAULTS.has(value)) {
        jwtProblems.push(
          `  - ${key}: must be explicitly set to a unique secret in production (development defaults are rejected)`,
        );
      } else if (value.length < MIN_JWT_SECRET_LENGTH) {
        jwtProblems.push(
          `  - ${key}: must be at least ${MIN_JWT_SECRET_LENGTH} characters in production`,
        );
      }
    }

    if (access === refresh) {
      jwtProblems.push(
        '  - JWT_REFRESH_SECRET: must differ from JWT_ACCESS_SECRET',
      );
    }

    if (jwtProblems.length > 0) {
      throw new Error(
        `Invalid environment configuration:\n${jwtProblems.join('\n')}`,
      );
    }

    const corsOrigins = result.data.CORS_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (
      corsOrigins.length === 0 ||
      corsOrigins.some((origin) => origin.includes('*'))
    ) {
      throw new Error(
        'Invalid environment configuration:\n  - CORS_ORIGINS: an explicit comma-separated allowlist of origins is required in production (wildcards are not allowed)',
      );
    }
  }

  const smtpInputProvided = Boolean(
    result.data.SMTP_HOST || result.data.SMTP_USER || result.data.SMTP_PASS,
  );
  const smtpConfigured = Boolean(
    result.data.SMTP_HOST && result.data.SMTP_USER && result.data.SMTP_PASS,
  );
  if (smtpInputProvided && !smtpConfigured) {
    const missing = [
      ['SMTP_HOST', result.data.SMTP_HOST],
      ['SMTP_USER', result.data.SMTP_USER],
      ['SMTP_PASS', result.data.SMTP_PASS],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => `  - ${key}: required when configuring SMTP`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${missing}`);
  }
  if ((result.data.RESEND_API_KEY || smtpConfigured) && !result.data.EMAIL_FROM) {
    throw new Error(
      'Invalid environment configuration:\n  - EMAIL_FROM: required when configuring email delivery',
    );
  }
  if (
    result.data.NODE_ENV === 'production' &&
    (!result.data.RESEND_API_KEY || !result.data.EMAIL_FROM)
  ) {
    throw new Error(
      'Invalid environment configuration:\n  - RESEND_API_KEY and EMAIL_FROM are required in production; configure complete SMTP credentials to enable fallback delivery',
    );
  }

  if (result.data.NODE_ENV === 'production') {
    const missing: string[] = [];
    if (!result.data.ABLINER_API_KEY) missing.push('ABLINER_API_KEY');
    else if (!result.data.ABLINER_API_KEY.startsWith('tsl_live_')) {
      missing.push('ABLINER_API_KEY (must be a production tsl_live_ key)');
    }
    if (!result.data.ABLINER_WEBHOOK_SECRET) {
      missing.push('ABLINER_WEBHOOK_SECRET');
    } else if (!result.data.ABLINER_WEBHOOK_SECRET.startsWith('whsec_')) {
      missing.push('ABLINER_WEBHOOK_SECRET (must be the Abliner whsec_ signing secret)');
    }
    if (missing.length > 0) {
      throw new Error(
        `Invalid environment configuration:\n${missing
          .map((key) => `  - ${key}: required in production`)
          .join('\n')}`,
      );
    }

    const callback = result.data.ABLINER_CALLBACK_URL;
    const isLocal = /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(callback);
    if (!callback.startsWith('https://') || isLocal) {
      throw new Error(
        'Invalid environment configuration:\n  - ABLINER_CALLBACK_URL: must be a public HTTPS URL in production',
      );
    }
  }

  return result.data;
}
