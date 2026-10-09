import type { WalletAccount } from './account';
import type { Currency } from './money';

export type OtpPurpose = 'login' | 'transaction' | 'pin_reset';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds. */
  expiresIn: number;
};

export type AuthUser = {
  id: string;
  memberId: string;
  fullName: string;
  firstName: string;
  phoneNumber: string;
  email: string | null;
  tier: 'Standard' | 'Verified';
  kycLevel: number;
  status: 'active' | 'pending' | 'restricted';
  currency: Currency;
};

export type AuthSession = {
  user: AuthUser;
  wallet: WalletAccount;
  tokens: AuthTokens;
};

/**
 * Outcome of verifying an OTP. A known phone yields a full session; an
 * unknown phone yields a short-lived setup token to complete registration.
 */
export type VerifyOtpResult =
  | { registrationRequired: true; setupToken: string; expiresIn: number }
  | { registrationRequired: false; session: AuthSession };

export type OtpChallengeResult = {
  /** Seconds before the code expires. */
  expiresIn: number;
  /** Seconds the client must wait before requesting another code. */
  retryAfter: number;
  /** Never expose the code in production; present only in sandbox/dev. */
  devCode?: string;
};

export type PinStatus = {
  pinSet: boolean;
  /** ISO timestamp while locked out after failed attempts, otherwise `null`. */
  lockedUntil: string | null;
};

export type DevicePlatform = 'android' | 'ios' | 'web';

export type TrustedDevice = {
  id: string;
  name: string;
  platform: DevicePlatform;
  location: string;
  /** ISO timestamp. */
  lastActiveAt: string;
  isCurrent: boolean;
};
