import type { AuthTokens } from './api';

export type AuthSession = {
  user: {
    firstName: string;
  };
  tokens: AuthTokens;
};

export type AdminSession = {
  userId: string;
  role: 'admin';
  staffRole: AdminStaffRole;
  capabilities: AdminCapability[];
};

export type AdminStaffRole =
  | 'super_admin'
  | 'merchant_operations'
  | 'customer_support'
  | 'finance_reconciliation';
export type AdminCapability =
  | 'admin:access'
  | 'admin:overview'
  | 'admin:merchant:read'
  | 'admin:merchant:write'
  | 'admin:user:read'
  | 'admin:user:write'
  | 'admin:transaction:read'
  | 'admin:audit:read'
  | 'admin:settings:read'
  | 'admin:settings:write'
  | 'admin:staff:manage'
  | 'admin:session:read'
  | 'admin:session:write'
  | 'admin:webhook:read'
  | 'admin:webhook:write'
  | 'admin:reconciliation:read'
  | 'admin:reconciliation:write'
  | 'admin:report:read'
  | 'admin:promotion:read'
  | 'admin:promotion:write'
  | 'admin:health:read';

export type AdminStaffSearchPage = {
  items: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    memberId: string;
    status: string;
    staffRole: AdminStaffRole | null;
    createdAt: string;
  }>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

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

export type AdminAuditPage = {
  items: Array<{
    id: string;
    actor: { id: string; name: string } | null;
    action: string;
    createdAt: string;
    ip: string | null;
    userAgent: string | null;
    metadata: unknown;
  }>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminMerchantApplication = {
  id: string;
  businessName: string;
  businessType?: string;
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

export type AdminUserSearchPage = {
  items: Array<{
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
  }>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminTransactionSearchPage = {
  items: Array<{
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
  }>;
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
  wallet: { currency: string; status: string; accountNumber: string } | null;
  devices: Array<{ id: string; name: string; platform: string; lastActiveAt: string; isCurrent: boolean }>;
  sessions: { active: number; revoked: number };
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
  user: { name: string; phone: string | null; memberId: string };
  ledgerEntries: Array<{ accountKind: string; direction: string; amount: string; createdAt: string }>;
  reconciliationEvents: Array<{ event: string; processed: boolean; errorPresent: boolean; createdAt: string }>;
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

export type AdminFeeRuleInput = {
  type: string;
  channel?: string | null;
  flat: number;
  percentage: number;
  minAmount: number;
  maxAmount?: number | null;
  active: boolean;
};

export type AdminFeeRuleUpdate = Partial<AdminFeeRuleInput>;

export type AdminSystemSettings = {
  generatedAt: string;
  merchantRegistrationFee: string | null;
  feeRules: AdminFeeRule[];
  tierLimits: {
    standard: { dailyOutflow: string; perTransaction: string };
    verified: { dailyOutflow: string; perTransaction: string };
  };
  reconciliation: { enabled: boolean; intervalSeconds: number; staleSeconds: number };
  integrations: Array<{ name: string; configuration: 'configured' | 'incomplete' }>;
};

export type RegistrationFee = { amount: number | null };

/* ------------------------------------------------------------------ */
/* Identity verification (KYC)                                        */
/* ------------------------------------------------------------------ */

export type AdminKycDocumentType = 'nida' | 'passport' | 'voters_card';
export type AdminKycSubmissionStatus = 'pending' | 'approved' | 'rejected';

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
  documentType: AdminKycDocumentType;
  documentNumberLast4: string;
  status: AdminKycSubmissionStatus;
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
  documentNumber: string;
  documentImage: string;
  reviewedBy: { id: string; name: string } | null;
};

/* ------------------------------------------------------------------ */
/* Sessions & devices                                                 */
/* ------------------------------------------------------------------ */

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
  merchants: { applications: number; approved: number; activeAccounts: number };
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

export type PromotionPlacement = 'home_banner' | 'wallet_banner' | 'notification';

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

export type PromotionInput = {
  title: string;
  body: string;
  placement: PromotionPlacement;
  imageUrl?: string;
  active: boolean;
  startsAt?: string;
  endsAt?: string;
};

export type PromotionUpdate = Partial<PromotionInput>;
