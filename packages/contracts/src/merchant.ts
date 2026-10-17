import { z } from 'zod';

import type { Transaction } from './transaction';
import { amountSchema, pinSchema, tzPhoneSchema } from './schemas';

/** Legal structures recognised for Tanzanian business registration. */
export const TANZANIA_MERCHANT_BUSINESS_TYPES = [
  'sole_proprietor',
  'partnership',
  'limited_company',
  'cooperative',
  'other',
] as const;

export const tanzaniaMerchantBusinessTypeSchema = z.enum(
  TANZANIA_MERCHANT_BUSINESS_TYPES,
);

export const TANZANIA_MERCHANT_BUSINESS_TYPE_LABELS: Record<
  TanzaniaMerchantBusinessType,
  string
> = {
  sole_proprietor: 'Sole proprietor',
  partnership: 'Partnership',
  limited_company: 'Limited company',
  cooperative: 'Cooperative',
  other: 'Other',
};

/** Tanzania's regions and regional-level authorities (mainland + Zanzibar). */
export const TANZANIA_REGIONS = [
  'Arusha',
  'Dar es Salaam',
  'Dodoma',
  'Geita',
  'Iringa',
  'Kagera',
  'Katavi',
  'Kigoma',
  'Kilimanjaro',
  'Lindi',
  'Manyara',
  'Mara',
  'Mbeya',
  'Morogoro',
  'Mtwara',
  'Mwanza',
  'Njombe',
  'Pwani',
  'Rukwa',
  'Ruvuma',
  'Shinyanga',
  'Simiyu',
  'Singida',
  'Songwe',
  'Tabora',
  'Tanga',
  'Kaskazini Pemba',
  'Kusini Pemba',
  'Kaskazini Unguja',
  'Kusini Unguja',
  'Mjini Magharibi',
] as const;

export const merchantApplicationSchema = z.object({
  businessName: z.string().trim().min(2).max(120),
  businessType: tanzaniaMerchantBusinessTypeSchema,
  category: z.string().trim().min(2).max(80),
  tin: z.string().trim().regex(/^\d{9}$/, 'TIN must be exactly 9 digits'),
  businessLicenceNumber: z.string().trim().min(2).max(60),
  region: z.string().trim().min(2).max(80),
  district: z.string().trim().min(2).max(80),
  physicalAddress: z.string().trim().min(4).max(200),
  phone: tzPhoneSchema,
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
  reason: z.string().trim().min(1).max(500).optional(),
});

export const merchantStaticQrSchema = z.object({
  expiresAt: z.string().datetime().optional(),
});

export const merchantFixedQrSchema = z.object({
  amount: amountSchema,
  reusable: z.boolean().default(false),
  // Optional so a reusable fixed-amount QR can live forever; when present it
  // must be a future timestamp (enforced by the service).
  expiresAt: z.string().datetime().optional(),
});

export const merchantPortalQuerySchema = z
  .object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(100).optional(),
    type: z
      .enum(['send', 'receive', 'payment', 'request', 'deposit', 'withdrawal'])
      .optional(),
    channel: z.enum(['wallet', 'bank', 'mobileMoney', 'card']).optional(),
    status: z
      .enum(['completed', 'processing', 'pending', 'failed', 'cancelled'])
      .optional(),
  })
  .superRefine((query, context) => {
    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'The end date must be on or after the start date',
      });
    }
  });

export const merchantQrPreviewSchema = z.object({
  code: z.string().trim().min(20).max(256),
  amount: amountSchema.optional(),
});

export const payMerchantQrSchema = merchantQrPreviewSchema.extend({
  pin: pinSchema,
  idempotencyKey: z.string().min(1).max(120),
});

export type TanzaniaMerchantBusinessType =
  (typeof TANZANIA_MERCHANT_BUSINESS_TYPES)[number];
export type TanzaniaRegion = (typeof TANZANIA_REGIONS)[number];
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
export type MerchantPortalQuery = z.infer<typeof merchantPortalQuerySchema>;
export type MerchantQrPreviewInput = z.infer<typeof merchantQrPreviewSchema>;
export type PayMerchantQrInput = z.infer<typeof payMerchantQrSchema>;

export type MerchantApplication = {
  id: string;
  businessName: string;
  businessType?: TanzaniaMerchantBusinessType;
  category: string;
  tin?: string;
  businessLicenceNumber?: string;
  region?: string;
  district?: string;
  physicalAddress?: string;
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

export type MerchantPortalTransaction = {
  id: string;
  reference: string;
  status: string;
  type: string;
  category: string;
  channel: string;
  amount: number;
  fee: number;
  total: number;
  merchantAmount: number;
  currency: string;
  createdAt: string;
  settledAt?: string;
};

export type MerchantPortalTransactions = {
  items: MerchantPortalTransaction[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type MerchantPortalQrCode = {
  id: string;
  kind: 'static' | 'fixed';
  amount?: number;
  reusable: boolean;
  uses: number;
  createdAt: string;
  expiresAt?: string;
  revokedAt?: string;
};

export type MerchantPortal = {
  application: MerchantApplication | null;
  merchant: null | {
    id: string;
    name: string;
    identifier: string;
    category: string;
    phone?: string;
    status: 'active' | 'suspended' | 'revoked';
    approvedAt?: string;
    currency: string;
    ledgerBalance: number;
  };
  report: null | {
    transactionCount: number;
    completedCount: number;
    pendingCount: number | null;
    failedCount: number | null;
    cancelledCount: number | null;
    grossReceived: number;
    customerFees: number;
    merchantFees: null;
    netReceived: number;
  };
  recentTransactions: MerchantPortalTransaction[];
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
