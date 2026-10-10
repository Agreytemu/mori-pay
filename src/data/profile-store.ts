import { useSession } from '@/lib/session';
import type {
  AppLanguage,
  NotificationPreferences,
  SecuritySettings,
  TrustedDevice,
  UserProfile,
} from '@/data/profile';
import type { NotificationPreference } from '@mori-pay/contracts';

export type EditableProfileFields = Pick<
  UserProfile,
  'fullName' | 'phone' | 'email' | 'dateOfBirth'
>;

const EMPTY_PREFERENCES: NotificationPreferences = {
  payments: true,
  transactions: true,
  securityAlerts: true,
  promotions: false,
};

export type ProfileState = {
  profile: UserProfile;
  security: SecuritySettings;
  devices: TrustedDevice[];
  preferences: NotificationPreferences;
  language: AppLanguage;
  pinUpdatedAt: string | null;
};

export function useProfileState(): ProfileState {
  const {
    accountProfile,
    user,
    devices,
    notificationPreferences,
    biometricsEnabled,
  } = useSession();

  const profile: UserProfile = {
    id: accountProfile?.id ?? user?.id ?? '',
    memberId: accountProfile?.memberId ?? user?.memberId ?? '',
    fullName: accountProfile?.fullName ?? user?.fullName ?? '',
    phone: accountProfile?.phoneNumber ?? user?.phoneNumber ?? '',
    email: accountProfile?.email ?? user?.email ?? '',
    dateOfBirth: accountProfile?.dateOfBirth ?? '',
    status:
      (accountProfile?.status ?? user?.status) === 'restricted'
        ? 'restricted'
        : (accountProfile?.tier ?? user?.tier) === 'Verified'
          ? 'verified'
          : 'pending',
    tier: accountProfile?.tier ?? user?.tier ?? 'Standard',
    joinedAt: accountProfile?.memberSince ?? '',
  };

  return {
    profile,
    security: {
      status: accountProfile?.status === 'restricted' ? 'attention' : 'protected',
      biometricsEnabled,
      loginAlertsEnabled: notificationPreferences?.securityAlerts ?? true,
      lastCheckedAt: accountProfile?.pinUpdatedAt ?? accountProfile?.memberSince ?? '',
    },
    devices,
    preferences: notificationPreferences
      ? fromApiPreferences(notificationPreferences)
      : EMPTY_PREFERENCES,
    language: 'en',
    pinUpdatedAt: accountProfile?.pinUpdatedAt ?? null,
  };
}

function fromApiPreferences(value: NotificationPreference): NotificationPreferences {
  return {
    payments: value.moneyIn || value.moneyOut,
    transactions: value.transactions,
    securityAlerts: value.securityAlerts,
    promotions: value.marketing,
  };
}
