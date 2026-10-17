export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type AuthSession = {
  user: {
    firstName: string;
  };
  tokens: AuthTokens;
};

export type EmailSignInInput = {
  email: string;
  password: string;
};

export type PinSignInInput = {
  email: string;
  pin: string;
};

export type MerchantApplication = {
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

export type MerchantQrCode = {
  id: string;
  code: string;
  kind: 'static' | 'fixed';
  amount?: number;
  reusable: boolean;
  expiresAt?: string;
};
