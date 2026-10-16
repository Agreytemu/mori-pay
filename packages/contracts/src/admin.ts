import { z } from 'zod';

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
  'admin:transaction:read',
  'admin:audit:read',
  'admin:settings:read',
  'admin:settings:write',
  'admin:staff:manage',
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
  ],
  customer_support: [
    'admin:access',
    'admin:overview',
    'admin:user:read',
  ],
  finance_reconciliation: [
    'admin:access',
    'admin:overview',
    'admin:transaction:read',
  ],
};

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
  q: z.string().trim().min(3).max(80),
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
  category: string;
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
  createdAt: string;
};

export type AdminUserSearchPage = {
  items: AdminUserSearchResult[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
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

export type AdminSystemSettings = {
  generatedAt: string;
  merchantRegistrationFee: string | null;
  feeRules: Array<{
    type: string;
    channel: string | null;
    flat: string;
    percentage: number;
    minAmount: string;
    maxAmount: string | null;
    active: boolean;
  }>;
  tierLimits: {
    standard: { dailyOutflow: string; perTransaction: string };
    verified: { dailyOutflow: string; perTransaction: string };
  };
  reconciliation: {
    enabled: boolean;
    intervalSeconds: number;
    staleSeconds: number;
  };
  integrations: Array<{
    name: string;
    configuration: 'configured' | 'incomplete';
  }>;
};
