import { z } from 'zod';

import { MOBILE_NETWORKS } from './abliner';

/** Canonical route/phone/amount validators shared by the API and the app. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TZ_PHONE_RE = /^255\d{9}$/;

export const tzPhoneSchema = z
  .string()
  .regex(TZ_PHONE_RE, 'Phone must be in 255XXXXXXXXX format');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(EMAIL_RE, 'Must be a valid email address');

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters');

export const pinSchema = z
  .string()
  .regex(/^\d{6}$/, 'PIN must be exactly 6 digits');

export const otpCodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'OTP must be exactly 6 digits');

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Date must be a valid calendar date');

/** Whole TZS, minimum 500 (mobile money operator floor). */
export const amountSchema = z
  .number()
  .int('Amount must be a whole number')
  .positive('Amount must be positive')
  .min(500, 'Minimum amount is 500 TZS')
  .max(Number.MAX_SAFE_INTEGER, 'Amount is too large');

const ablinerDepositAmountSchema = amountSchema.max(
  3_000_000,
  'Maximum deposit is 3,000,000 TZS',
);

export const mobileNetworkSchema = z.enum(MOBILE_NETWORKS);

export const deviceInfoSchema = z.object({
  name: z.string().min(1).max(120),
  platform: z.enum(['android', 'ios', 'web']),
  installationId: z.string().min(16).max(128).optional(),
  pushToken: z.string().min(1).optional(),
});

export const requestOtpSchema = z.object({
  phone: tzPhoneSchema,
});

export const verifyOtpSchema = z.object({
  phone: tzPhoneSchema,
  code: otpCodeSchema,
  device: deviceInfoSchema.optional(),
});

export const registerSchema = z.object({
  setupToken: z.string().min(1),
  fullName: z.string().min(2).max(120),
  firstName: z.string().min(1).max(60),
  email: emailSchema.optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dateOfBirth must be formatted YYYY-MM-DD')
    .optional(),
});

export const emailSignInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
  device: deviceInfoSchema.optional(),
});

export const emailOnlySchema = z.object({
  email: emailSchema,
});

export const pinSignInSchema = z.object({
  email: emailSchema,
  pin: pinSchema,
  device: deviceInfoSchema.optional(),
});

export const emailRegisterSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  firstName: z.string().trim().min(1).max(60),
  email: emailSchema,
  password: passwordSchema,
  dateOfBirth: dateOnlySchema.optional(),
});

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  device: deviceInfoSchema.optional(),
});

export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  password: passwordSchema,
});

export const emailCredentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const updateAccountProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: emailSchema.nullable(),
  dateOfBirth: dateOnlySchema.nullable(),
});

export const savePaymentMethodSchema = z.object({
  kind: z.enum(['mobile-money', 'bank', 'card']),
  provider: z.string().trim().min(1).max(80),
  lastFour: z.string().regex(/^\d{4}$/, 'Only the last four digits are accepted'),
  isDefault: z.boolean().optional(),
});

export const updateNotificationPreferencesSchema = z.object({
  transactions: z.boolean().optional(),
  moneyIn: z.boolean().optional(),
  moneyOut: z.boolean().optional(),
  marketing: z.boolean().optional(),
  securityAlerts: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one preference is required');

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const setPinSchema = z.object({
  pin: pinSchema,
});

export const changePinSchema = z.object({
  currentPin: pinSchema,
  newPin: pinSchema,
});

export const verifyPinSchema = z.object({
  pin: pinSchema,
});

export const previewTransferSchema = z.object({
  recipientPhone: tzPhoneSchema,
  amount: amountSchema,
});

export const sendMoneySchema = previewTransferSchema.extend({
  note: z.string().max(140).optional(),
  pin: pinSchema,
  idempotencyKey: z.string().min(1).max(120).optional(),
});

export const requestMoneySchema = z.object({
  payerPhone: tzPhoneSchema,
  amount: amountSchema,
  note: z.string().max(140).optional(),
});

export const payRequestSchema = z.object({
  pin: pinSchema,
  idempotencyKey: z.string().min(1).max(120).optional(),
});

export const payMerchantSchema = z.object({
  merchantId: z.string().min(1),
  amount: amountSchema,
  note: z.string().max(140).optional(),
  paymentMethodId: z.string().min(1).optional(),
  pin: pinSchema,
  idempotencyKey: z.string().min(1).max(120).optional(),
});

export const merchantPaymentPreviewSchema = z.object({
  merchantId: z.string().min(1),
  amount: amountSchema,
});

export const recipientLookupSchema = z.object({
  phone: tzPhoneSchema,
});

export const verifyReceiveCodeSchema = z.object({
  code: z.string().trim().min(1).max(1024),
});

export const withdrawalPreviewQuerySchema = z.object({
  amount: z.coerce
    .number()
    .int('Amount must be a whole number')
    .positive('Amount must be positive')
    .min(500, 'Minimum amount is 500 TZS')
    .max(Number.MAX_SAFE_INTEGER, 'Amount is too large'),
});

export const topupCardPreviewQuerySchema = z.object({
  amount: z.coerce
    .number()
    .int('Amount must be a whole number')
    .positive('Amount must be positive')
    .min(500, 'Minimum amount is 500 TZS')
    .max(3_000_000, 'Maximum deposit is 3,000,000 TZS'),
});

export const topupMobileMoneySchema = z.object({
  amount: ablinerDepositAmountSchema,
  mobileNumber: tzPhoneSchema,
  /** Display-only operator hint; Abliner routes the rail automatically. */
  network: mobileNetworkSchema.optional(),
  idempotencyKey: z.string().min(1).max(120).optional(),
});

export const topupCardSchema = z.object({
  amount: ablinerDepositAmountSchema,
  customerEmail: emailSchema.optional(),
  customerName: z.string().min(1).max(120).optional(),
  customerPhone: tzPhoneSchema.optional(),
  billingAddress: z.string().max(200).optional(),
  postalCode: z.string().max(20).optional(),
  idempotencyKey: z.string().min(1).max(120).optional(),
  expectedFee: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
});

export const withdrawalSchema = z.object({
  amount: amountSchema,
  phoneNumber: tzPhoneSchema,
  /** Display-only operator hint; Abliner routes the rail automatically. */
  network: mobileNetworkSchema.optional(),
  accountName: z.string().max(120).optional(),
  pin: pinSchema,
  idempotencyKey: z.string().min(1).max(120).optional(),
  expectedFee: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
});

export const ablinerWebhookSchema = z.object({
  id: z.string().min(1),
  event: z.enum([
    'transaction.completed',
    'transaction.failed',
    'withdrawal.completed',
    'withdrawal.failed',
    'checkout.paid',
  ]),
  created_at: z.string().optional(),
  data: z.object({
    id: z.string().min(1),
    type: z.enum(['deposit', 'withdrawal', 'checkout']),
    method: z.string().nullish(),
    amount: z.number(),
    amount_cents: z.number().optional(),
    currency: z.string(),
    status: z.enum(['pending', 'completed', 'failed']),
    reference: z.string(),
    customer_reference: z.string().nullish(),
    provider_reference: z.string().nullish(),
    recipient: z.string().nullish(),
    completed_at: z.string().nullish(),
    payer_account: z.string().optional(),
    payer_name: z.string().optional(),
    paid_at: z.string().optional(),
  }),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateAccountProfileInput = z.infer<typeof updateAccountProfileSchema>;
export type SavePaymentMethodInput = z.infer<typeof savePaymentMethodSchema>;
export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type SetPinInput = z.infer<typeof setPinSchema>;
export type ChangePinInput = z.infer<typeof changePinSchema>;
export type VerifyPinInput = z.infer<typeof verifyPinSchema>;
export type DeviceInfo = z.infer<typeof deviceInfoSchema>;
export type SendMoneyInput = z.infer<typeof sendMoneySchema>;
export type PreviewTransferInput = z.infer<typeof previewTransferSchema>;
export type RequestMoneyInput = z.infer<typeof requestMoneySchema>;
export type PayRequestInput = z.infer<typeof payRequestSchema>;
export type PayMerchantInput = z.infer<typeof payMerchantSchema>;
export type MerchantPaymentPreviewInput = z.infer<typeof merchantPaymentPreviewSchema>;
export type RecipientLookupInput = z.infer<typeof recipientLookupSchema>;
export type VerifyReceiveCodeInput = z.infer<typeof verifyReceiveCodeSchema>;
export type WithdrawalPreviewQuery = z.infer<typeof withdrawalPreviewQuerySchema>;
export type TopupCardPreviewQuery = z.infer<typeof topupCardPreviewQuerySchema>;
export type TopupMobileMoneyInput = z.infer<typeof topupMobileMoneySchema>;
export type TopupCardInput = z.infer<typeof topupCardSchema>;
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;
export type AblinerWebhookInput = z.infer<typeof ablinerWebhookSchema>;
