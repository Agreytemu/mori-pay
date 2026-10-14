import { z } from 'zod';

import type { Transaction } from './transaction';
import { amountSchema, pinSchema } from './schemas';

export const merchantApplicationSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).optional(),
});

export const merchantRegistrationPaymentSchema = z.object({
  pin: pinSchema,
  idempotencyKey: z.string().min(1).max(120),
});

export const merchantRegistrationFeeSchema = z.object({
  amount: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER),
});

export const merchantApplicationReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reviewNote: z.string().trim().max(500).optional(),
});

export const merchantAccountStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'revoked']),
});

export const merchantStaticQrSchema = z.object({
  expiresAt: z.string().datetime().optional(),
});

export const merchantFixedQrSchema = z.object({
  amount: amountSchema,
  reusable: z.boolean().default(false),
  expiresAt: z.string().datetime(),
});

export const merchantQrPreviewSchema = z.object({
  code: z.string().trim().min(20).max(256),
  amount: amountSchema.optional(),
});

export const payMerchantQrSchema = merchantQrPreviewSchema.extend({
  pin: pinSchema,
  idempotencyKey: z.string().min(1).max(120),
});

export type MerchantApplicationInput = z.infer<typeof merchantApplicationSchema>;
export type MerchantRegistrationPaymentInput = z.infer<
  typeof merchantRegistrationPaymentSchema
>;
export type MerchantRegistrationFeeInput = z.infer<
  typeof merchantRegistrationFeeSchema
>;
export type MerchantApplicationReviewInput = z.infer<
  typeof merchantApplicationReviewSchema
>;
export type MerchantAccountStatusInput = z.infer<
  typeof merchantAccountStatusSchema
>;
export type MerchantStaticQrInput = z.infer<typeof merchantStaticQrSchema>;
export type MerchantFixedQrInput = z.infer<typeof merchantFixedQrSchema>;
export type MerchantQrPreviewInput = z.infer<typeof merchantQrPreviewSchema>;
export type PayMerchantQrInput = z.infer<typeof payMerchantQrSchema>;

export type MerchantApplication = {
  id: string;
  businessName: string;
  category: string;
  phone?: string;
  status: 'pending_payment' | 'awaiting_review' | 'approved' | 'rejected';
  registrationFeeAmount?: number;
  paidAt?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewNote?: string;
};

export type MerchantRegistrationFee = { amount: number | null };

export type MerchantQrCode = {
  id: string;
  code: string;
  kind: 'static' | 'fixed';
  amount?: number;
  reusable: boolean;
  expiresAt?: string;
};

export type MerchantQrPreview = {
  merchantName: string;
  amount: number;
  fee: 0;
  total: number;
};

export type PayMerchantQrResult = {
  transaction: Transaction;
  merchantName: string;
  fee: 0;
};
