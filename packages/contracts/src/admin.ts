import { z } from 'zod';

import type { KycDocumentType, KycSubmissionStatus } from './account';
import type { TanzaniaMerchantBusinessType } from './merchant';

export const adminStaffRoleSchema = z.enum([
  'super_admin',
  'merchant_operations',
  'customer_support',
  'finance_reconciliation',
]);

export type AdminStaffRole = z.infer<typeof adminStaffRoleSchema>;

export const adminStaffSearchQuerySchema = z.object({
  q: z.string().trim().min(3).max(80),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type AdminStaffSearchQuery = z.infer<typeof adminStaffSearchQuerySchema>;

export const adminStaffRoleUpdateSchema = z.object({
  role: adminStaffRoleSchema.nullable(),
});

export type AdminStaffRoleUpdate = z.infer<typeof adminStaffRoleUpdateSchema>;

export const ADMIN_CAPABILITIES = [
  'admin:access',
  'admin:overview',
  'admin:merchant:read',
  'admin:merchant:write',
  'admin:user:read',
  'admin:user:write',
  'admin:transaction:read',
  'admin:audit:read',
  'admin:settings:read',
  'admin:settings:write',
  'admin:staff:manage',
  'admin:session:read',
  'admin:session:write',
  'admin:webhook:read',
  'admin:webhook:write',
  'admin:reconciliation:read',
  'admin:reconciliation:write',
  'admin:report:read',
  'admin:promotion:read',
  'admin:promotion:write',
  'admin:health:read',
] as const;

export type AdminCapability = (typeof ADMIN_CAPABILITIES)[number];

const SUPER_ADMIN_CAPABILITIES: readonly AdminCapability[] = ADMIN_CAPABILITIES;

export const ADMIN_ROLE_CAPABILITIES: Record<AdminStaffRole, readonly AdminCapability[]> = {
  super_admin: SUPER_ADMIN_CAPABILITIES,
  merchant_operations: [
    'admin:access',
    'admin:overview',
    'admin:merchant:read',
    'admin:merchant:write',
    'admin:promotion:read',
    'admin:promotion:write',
  ],
  customer_support: [
    'admin:access',
    'admin:overview',
    'admin:user:read',
    'admin:user:write',
    'admin:session:read',
    'admin:session:write',
  ],
  finance_reconciliation: [
    'admin:access',
    'admin:overview',
    'admin:transaction:read',
    'admin:report:read',
    'admin:webhook:read',
    'admin:reconciliation:read',
    'admin:reconciliation:write',
    'admin:health:read',
  ],
};

export const userStatusSchema = z.enum(['active', 'pending', 'restricted']);

export const accountTierSchema = z.enum(['Standard', 'Verified']);

export const adminUserStatusUpdateSchema = z.object({
  status: userStatusSchema,
  reason: z.string().trim().min(3).max(200).optional(),
});
export type AdminUserStatusUpdate = z.infer<typeof adminUserStatusUpdateSchema>;

export const adminUserKycUpdateSchema = z.object({
  kycLevel: z.number().int().min(0).max(3),
  reason: z.string().trim().min(3).max(200).optional(),
});
export type AdminUserKycUpdate = z.infer<typeof adminUserKycUpdateSchema>;

export const adminUserTierUpdateSchema = z.object({
  tier: accountTierSchema,
  reason: z.string().trim().min(3).max(200).optional(),
});
export type AdminUserTierUpdate = z.infer<typeof adminUserTierUpdateSchema>;

export const adminKycListQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).default('pending'),
  q: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type AdminKycListQuery = z.infer<typeof adminKycListQuerySchema>;

export const adminKycDecisionSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().trim().min(3).max(300).optional(),
});
export type AdminKycDecision = z.infer<typeof adminKycDecisionSchema>;

export function capabilitiesForAdminRole(role: AdminStaffRole): readonly AdminCapability[] {
  return ADMIN_ROLE_CAPABILITIES[role];
}

export type AdminStaffSearchResult = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  memberId: string;
  status: string;
  staffRole: AdminStaffRole | null;
  createdAt: string;
};

export type AdminStaffSearchPage = {
  items: AdminStaffSearchResult[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export const adminListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type AdminListQuery = z.infer<typeof adminListQuerySchema>;

export const adminSearchQuerySchema = adminListQuerySchema.extend({
  // Optional so administrators can browse the full directory without typing a
  // query. When provided it must be a meaningful length.
  q: z.string().trim().min(3).max(80).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
});

export type AdminSearchQuery = z.infer<typeof adminSearchQuerySchema>;

export const adminAuditQuerySchema = adminListQuerySchema.extend({
  action: z.string().trim().min(3).max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine(
  ({ from, to }) => !from || !to || from <= to,
  { message: 'The start date must be before the end date', path: ['from'] },
);

export type AdminAuditQuery = z.infer<typeof adminAuditQuerySchema>;

export type AdminOverview = {
  generatedAt: string;
  users: { total: number; active: number; restricted: number };
  merchantApplications: {
    pendingPayment: number;
    awaitingReview: number;
    approved: number;
    rejected: number;
  };
  merchantAccounts: { active: number; suspended: number; revoked: number };
  transactions: {
    completed: number;
    pending: number;
    processing: number;
    failed: number;
    cancelled: number;
    byChannel: Array<{ channel: string; count: number }>;
  };
  webhookEvents: { awaitingProcessing: number; failedProcessing: number };
};

export type AdminAuditEntry = {
  id: string;
  actor: { id: string; name: string } | null;
  action: string;
  createdAt: string;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
};

export type AdminAuditPage = {
  items: AdminAuditEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminMerchantApplication = {
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
  applicantName: string;
  applicantPhone?: string;
};

export type AdminMerchantApplicationPage = {
  items: AdminMerchantApplication[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminMerchantAccount = {
  id: string;
  name: string;
  identifier: string;
  category: string;
  phone?: string;
  status: 'active' | 'suspended' | 'revoked';
  ownerName: string;
  ownerPhone?: string;
  createdAt: string;
};

export type AdminMerchantAccountPage = {
  items: AdminMerchantAccount[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminUserSearchResult = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  memberId: string;
  status: string;
  tier: string;
  kycLevel: number;
  isOnline: boolean;
  lastActiveAt: string | null;
  activeSessions: number;
  deviceCount: number;
  createdAt: string;
};

export type AdminUserSearchPage = {
  items: AdminUserSearchResult[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminKycSubmissionSummary = {
  id: string;
  user: {
    id: string;
    name: string;
    phone: string | null;
    memberId: string;
    tier: string;
    kycLevel: number;
  };
  documentType: KycDocumentType;
  documentNumberLast4: string;
  status: KycSubmissionStatus;
  rejectionReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
};

export type AdminKycSubmissionPage = {
  items: AdminKycSubmissionSummary[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminKycSubmissionDetail = AdminKycSubmissionSummary & {
  /** Full decrypted ID number, shown only to authorised reviewers. */
  documentNumber: string;
  /** Data URL of the uploaded ID photo. */
  documentImage: string;
  reviewedBy: { id: string; name: string } | null;
};

export type AdminTransactionSearchResult = {
  id: string;
  reference: string;
  type: string;
  status: string;
  category: string;
  channel: string;
  direction: string;
  amount: string;
  fee: string;
  total: string;
  currency: string;
  provider: string | null;
  providerStatus: string | null;
  createdAt: string;
  settledAt: string | null;
  user: {
    name: string;
    phone: string | null;
    memberId: string;
  };
};

export type AdminTransactionSearchPage = {
  items: AdminTransactionSearchResult[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminUserDetail = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  memberId: string;
  status: string;
  tier: string;
  kycLevel: number;
  createdAt: string;
  wallet: {
    currency: string;
    status: string;
    accountNumber: string;
  } | null;
  devices: Array<{
    id: string;
    name: string;
    platform: string;
    lastActiveAt: string;
    isCurrent: boolean;
  }>;
  sessions: {
    active: number;
    revoked: number;
  };
};

export type AdminTransactionDetail = {
  id: string;
  reference: string;
  type: string;
  status: string;
  category: string;
  channel: string;
  direction: string;
  amount: string;
  fee: string;
  total: string;
  currency: string;
  provider: string | null;
  providerStatus: string | null;
  createdAt: string;
  updatedAt: string;
  settledAt: string | null;
  user: {
    name: string;
    phone: string | null;
    memberId: string;
  };
  ledgerEntries: Array<{
    accountKind: string;
    direction: string;
    amount: string;
    createdAt: string;
  }>;
  reconciliationEvents: Array<{
    event: string;
    processed: boolean;
    errorPresent: boolean;
    createdAt: string;
  }>;
};

export type AdminFeeRule = {
  id: string;
  type: string;
  channel: string | null;
  flat: string;
  percentage: number;
  minAmount: string;
  maxAmount: string | null;
  active: boolean;
  createdAt: string;
};

const adminFeeRuleBaseSchema = z.object({
  type: z.string().trim().min(1).max(60),
  channel: z.string().trim().min(1).max(60).nullable().optional(),
  flat: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  percentage: z.coerce.number().min(0).max(1),
  minAmount: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  maxAmount: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().optional(),
  active: z.boolean().default(true),
});

export const adminFeeRuleInputSchema = adminFeeRuleBaseSchema.refine(
  ({ minAmount, maxAmount }) => maxAmount == null || maxAmount >= minAmount,
  { message: 'The maximum amount must be greater than or equal to the minimum', path: ['maxAmount'] },
);
export type AdminFeeRuleInput = z.infer<typeof adminFeeRuleInputSchema>;

export const adminFeeRuleUpdateSchema = adminFeeRuleBaseSchema.partial();
export type AdminFeeRuleUpdate = z.infer<typeof adminFeeRuleUpdateSchema>;

export type AdminSystemSettings = {
  generatedAt: string;
  merchantRegistrationFee: string | null;
  feeRules: AdminFeeRule[];
  tierLimits: {
    standard: { dailyOutflow: string; perTransaction: string };
    verified: { dailyOutflow: string; perTransaction: string };
  };
  reconciliation: {
    enabled: boolean;
    intervalSeconds: number;
    staleSeconds: number;
  };
  paymentProviders: {
    primaryProvider: 'abliner' | 'clickpesa';
    paymentMethods: {
      mobileMoneyEnabled: boolean;
      bankEnabled: boolean;
      cardEnabled: boolean;
    };
    providers: Array<{
      id: 'abliner' | 'clickpesa';
      name: string;
      configured: boolean;
      enabled: boolean;
      primary: boolean;
      services: Array<{
        id: string;
        name: string;
        status: 'active' | 'inactive' | 'not_implemented';
        networks?: Array<{
          id: string;
          name: string;
          image: 'mpesa' | 'airtel' | 'mixx' | 'halopesa';
          status: 'active' | 'inactive';
        }>;
      }>;
    }>;
  };
  integrations: Array<{
    name: string;
    configuration: 'configured' | 'incomplete';
  }>;
};

export const adminPaymentProviderUpdateSchema = z
  .object({
    ablinerEnabled: z.boolean(),
    clickpesaEnabled: z.boolean(),
    primaryProvider: z.enum(['abliner', 'clickpesa']),
  })
  .refine(
    (settings) =>
      (!settings.ablinerEnabled && !settings.clickpesaEnabled) ||
      (settings.primaryProvider === 'abliner'
        ? settings.ablinerEnabled
        : settings.clickpesaEnabled),
    {
      message: 'The primary payment provider must be enabled.',
      path: ['primaryProvider'],
    },
  );
export type AdminPaymentProviderUpdate = z.infer<
  typeof adminPaymentProviderUpdateSchema
>;

export const adminPaymentMethodVisibilitySchema = z.object({
  mobileMoneyEnabled: z.boolean(),
  bankEnabled: z.boolean(),
  cardEnabled: z.boolean(),
});
export type AdminPaymentMethodVisibility = z.infer<
  typeof adminPaymentMethodVisibilitySchema
>;

/* ------------------------------------------------------------------ */
/* Sessions & devices                                                 */
/* ------------------------------------------------------------------ */

export const adminSessionQuerySchema = adminListQuerySchema.extend({
  q: z.string().trim().min(1).max(80).optional(),
  state: z.enum(['active', 'revoked']).optional(),
});
export type AdminSessionQuery = z.infer<typeof adminSessionQuerySchema>;

export type AdminSessionResult = {
  id: string;
  user: { id: string; name: string; memberId: string };
  device: { name: string; platform: string } | null;
  isActive: boolean;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastActiveAt: string | null;
};

export type AdminSessionSearchPage = {
  items: AdminSessionResult[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/* ------------------------------------------------------------------ */
/* Webhook events                                                     */
/* ------------------------------------------------------------------ */

export const adminWebhookQuerySchema = adminListQuerySchema.extend({
  q: z.string().trim().min(1).max(120).optional(),
  state: z.enum(['pending', 'processed', 'failed']).optional(),
});
export type AdminWebhookQuery = z.infer<typeof adminWebhookQuerySchema>;

export type AdminWebhookEventResult = {
  id: string;
  eventId: string;
  event: string;
  transactionReference: string;
  processed: boolean;
  errorPresent: boolean;
  error: string | null;
  createdAt: string;
  processedAt: string | null;
};

export type AdminWebhookEventPage = {
  items: AdminWebhookEventResult[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/* ------------------------------------------------------------------ */
/* Reconciliation                                                     */
/* ------------------------------------------------------------------ */

export const adminReconciliationQuerySchema = adminListQuerySchema.extend({
  state: z.enum(['stale', 'unsettled', 'all']).default('stale'),
});
export type AdminReconciliationQuery = z.infer<typeof adminReconciliationQuerySchema>;

export type AdminReconciliationResult = {
  id: string;
  reference: string;
  type: string;
  status: string;
  channel: string;
  amount: string;
  currency: string;
  provider: string | null;
  providerStatus: string | null;
  ageSeconds: number;
  createdAt: string;
  settledAt: string | null;
};

export type AdminReconciliationPage = {
  items: AdminReconciliationResult[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  staleSeconds: number;
};

/* ------------------------------------------------------------------ */
/* Reports                                                            */
/* ------------------------------------------------------------------ */

export const adminReportQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine(
  ({ from, to }) => !from || !to || from <= to,
  { message: 'The start date must be before the end date', path: ['from'] },
);
export type AdminReportQuery = z.infer<typeof adminReportQuerySchema>;

export type AdminReport = {
  generatedAt: string;
  from: string | null;
  to: string | null;
  users: { created: number; active: number; restricted: number };
  transactions: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    volume: string;
    fees: string;
    currency: string;
    byChannel: Array<{ channel: string; count: number; volume: string }>;
    byStatus: Array<{ status: string; count: number }>;
  };
  merchants: {
    applications: number;
    approved: number;
    activeAccounts: number;
  };
};

/* ------------------------------------------------------------------ */
/* System health                                                      */
/* ------------------------------------------------------------------ */

export type AdminHealth = {
  generatedAt: string;
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  environment: string;
  database: { ok: boolean; responseMs: number };
  heapUsedMb: number;
  webhooks: { awaitingProcessing: number; failedProcessing: number };
};

/* ------------------------------------------------------------------ */
/* Promotions & banners                                               */
/* ------------------------------------------------------------------ */

export const promotionPlacementSchema = z.enum(['home_banner', 'wallet_banner', 'notification']);
export type PromotionPlacement = z.infer<typeof promotionPlacementSchema>;

const promotionBaseSchema = z.object({
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(400),
  placement: promotionPlacementSchema,
  imageUrl: z.string().trim().url().max(500).optional(),
  active: z.boolean().default(true),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});

export const promotionInputSchema = promotionBaseSchema.refine(
  ({ startsAt, endsAt }) => !startsAt || !endsAt || startsAt <= endsAt,
  { message: 'The start date must be before the end date', path: ['startsAt'] },
);
export type PromotionInput = z.infer<typeof promotionInputSchema>;

export const promotionUpdateSchema = promotionBaseSchema.partial();
export type PromotionUpdate = z.infer<typeof promotionUpdateSchema>;

export type Promotion = {
  id: string;
  title: string;
  body: string;
  placement: PromotionPlacement;
  imageUrl: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PromotionPage = {
  items: Promotion[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
