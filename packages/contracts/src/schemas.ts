import { z } from 'zod';

import { STAKABA_NETWORKS } from './stakaba';

/** Canonical route/phone/amount validators shared by the API and the app. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TZ_PHONE_RE = /^255\d{9}$/;

export const tzPhoneSchema = z
  .string()
  .regex(TZ_PHONE_RE, 'Phone must be in 255XXXXXXXXX format');

export const emailSchema = z
  .string()
  .regex(EMAIL_RE, 'Must be a valid email address');

export const pinSchema = z
  .string()
  .regex(/^\d{6}$/, 'PIN must be exactly 6 digits');

export const otpCodeSchema = z
  .string()
  .regex(/^\d{6}$/, 'OTP must be exactly 6 digits');

/** Whole TZS, minimum 500 (mobile money operator floor). */
export const amountSchema = z
  .number()
  .int('Amount must be a whole number')
  .positive('Amount must be positive')
  .min(500, 'Minimum amount is 500 TZS');

export const stakabaNetworkSchema = z.enum(STAKABA_NETWORKS);

export const deviceInfoSchema = z.object({
  name: z.string().min(1).max(120),
  platform: z.enum(['android', 'ios', 'web']),
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

export const recipientLookupSchema = z.object({
  phone: tzPhoneSchema,
});

export const topupMobileMoneySchema = z.object({
  amount: amountSchema,
  mobileNumber: tzPhoneSchema,
  network: stakabaNetworkSchema,
});

export const topupCardSchema = z.object({
  amount: amountSchema,
  customerEmail: emailSchema,
  customerName: z.string().min(1).max(120),
  customerPhone: tzPhoneSchema,
  billingAddress: z.string().max(200).optional(),
  postalCode: z.string().max(20).optional(),
});

export const withdrawalSchema = z.object({
  amount: amountSchema,
  phoneNumber: tzPhoneSchema,
  network: stakabaNetworkSchema,
  accountName: z.string().max(120).optional(),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
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
export type RecipientLookupInput = z.infer<typeof recipientLookupSchema>;
export type TopupMobileMoneyInput = z.infer<typeof topupMobileMoneySchema>;
export type TopupCardInput = z.infer<typeof topupCardSchema>;
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;
