import { useSyncExternalStore } from 'react';

import {
  MOCK_NOTIFICATION_PREFERENCES,
  MOCK_PROFILE,
  MOCK_SECURITY,
  MOCK_TRUSTED_DEVICES,
  type AppLanguage,
  type NotificationPreferenceKey,
  type NotificationPreferences,
  type SecuritySettings,
  type TrustedDevice,
  type UserProfile,
} from '@/data/profile';

/** Fields a user is allowed to change locally. */
export type EditableProfileFields = Pick<
  UserProfile,
  'fullName' | 'phone' | 'email' | 'dateOfBirth'
>;

export type ProfileState = {
  profile: UserProfile;
  security: SecuritySettings;
  devices: TrustedDevice[];
  preferences: NotificationPreferences;
  language: AppLanguage;
  /** ISO timestamp of the last local PIN change, or `null`. */
  pinUpdatedAt: string | null;
};

let state: ProfileState = {
  profile: { ...MOCK_PROFILE },
  security: { ...MOCK_SECURITY },
  devices: MOCK_TRUSTED_DEVICES.map((device) => ({ ...device })),
  preferences: { ...MOCK_NOTIFICATION_PREFERENCES },
  language: 'en',
  pinUpdatedAt: null,
};

const listeners = new Set<() => void>();

function setState(next: ProfileState) {
  state = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getState() {
  return state;
}

/** Whole store, for screens that read profile + settings together. */
export function useProfileState() {
  return useSyncExternalStore(subscribe, getState, getState);
}

export function useProfile(): UserProfile {
  return useProfileState().profile;
}

export function useSecurity(): SecuritySettings {
  return useProfileState().security;
}

export function useTrustedDevices(): TrustedDevice[] {
  return useProfileState().devices;
}

export function useNotificationPreferences(): NotificationPreferences {
  return useProfileState().preferences;
}

export function useAppLanguage(): AppLanguage {
  return useProfileState().language;
}

export function updateProfile(fields: EditableProfileFields) {
  setState({ ...state, profile: { ...state.profile, ...fields } });
}

export function setBiometricsEnabled(enabled: boolean) {
  setState({ ...state, security: { ...state.security, biometricsEnabled: enabled } });
}

export function setLoginAlertsEnabled(enabled: boolean) {
  setState({ ...state, security: { ...state.security, loginAlertsEnabled: enabled } });
}

export function removeDevice(id: string) {
  setState({
    ...state,
    devices: state.devices.filter((device) => device.id !== id && device.isCurrent),
  });
}

export function setNotificationPreference(key: NotificationPreferenceKey, value: boolean) {
  setState({
    ...state,
    preferences: { ...state.preferences, [key]: value },
  });
}

export function setLanguage(language: AppLanguage) {
  setState({ ...state, language });
}

/**
 * Records a successful local PIN change. No PIN value is stored anywhere — only
 * the timestamp, so the security screen can show the most recent change.
 */
export function recordPinChange() {
  setState({ ...state, pinUpdatedAt: new Date().toISOString() });
}

/**
 * Placeholder for a real auth service. Wiring logout later means calling the
 * session service here and clearing cached account data; the UI already shows
 * the confirmation flow it will be used from.
 */
export function signOut(): void {}