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
  | 'admin:transaction:read'
  | 'admin:audit:read'
  | 'admin:settings:read'
  | 'admin:settings:write'
  | 'admin:staff:manage';

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
  }>;
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
  devices: Array<{ platform: string; lastActiveAt: string; isCurrent: boolean }>;
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
  reconciliation: { enabled: boolean; intervalSeconds: number; staleSeconds: number };
  integrations: Array<{ name: string; configuration: 'configured' | 'incomplete' }>;
};

export type RegistrationFee = { amount: number | null };
