import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  AuthSession,
  AuthUser,
  AccountProfile,
  NotificationPreference,
  PinStatus,
  TrustedDevice,
  UpdateAccountProfileInput,
  UpdateNotificationPreferencesInput,
  WalletAccount,
} from '@mori-pay/contracts';

import { callLogout, hydrateTokens, persistTokens } from './api';
import * as api from './mori-api';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export type SessionValue = {
  status: SessionStatus;
  user: AuthUser | null;
  wallet: WalletAccount | null;
  pin: PinStatus | null;
  accountProfile: AccountProfile | null;
  devices: TrustedDevice[];
  notificationPreferences: NotificationPreference | null;
  accountDataError: Error | null;
  biometricsEnabled: boolean;
  signIn: (session: AuthSession) => Promise<PinStatus>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
  reloadAccountData: () => Promise<void>;
  updateProfile: (input: UpdateAccountProfileInput) => Promise<void>;
  removeDevice: (id: string) => Promise<void>;
  updateNotificationPreferences: (input: UpdateNotificationPreferencesInput) => Promise<void>;
  setBiometricsEnabled: (enabled: boolean) => void;
  setWallet: (wallet: WalletAccount) => void;
  setPin: (pin: PinStatus) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [wallet, setWalletState] = useState<WalletAccount | null>(null);
  const [pin, setPinState] = useState<PinStatus | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [notificationPreferences, setNotificationPreferences] =
    useState<NotificationPreference | null>(null);
  const [accountDataError, setAccountDataError] = useState<Error | null>(null);
  const [biometricsEnabled, setBiometricsEnabledState] = useState(false);

  const reloadAccountData = useCallback(async () => {
    try {
      const [profile, nextDevices, preferences] = await Promise.all([
        api.getAccountProfile(),
        api.listTrustedDevices(),
        api.getNotificationPreferences(),
      ]);
      setAccountProfile(profile);
      setDevices(nextDevices);
      setNotificationPreferences(preferences);
      setAccountDataError(null);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      setAccountDataError(normalized);
    }
  }, []);

  const clear = useCallback(() => {
    setUser(null);
    setWalletState(null);
    setPinState(null);
    setAccountProfile(null);
    setDevices([]);
    setNotificationPreferences(null);
    setAccountDataError(null);
    setBiometricsEnabledState(false);
    setStatus('unauthenticated');
  }, []);

  const reload = useCallback(async () => {
    const tokens = await hydrateTokens();
    if (!tokens) {
      clear();
      return;
    }
    try {
      const [me, pinStatus] = await Promise.all([api.fetchMe(), api.fetchPinStatus()]);
      setUser(me.user);
      setWalletState(me.wallet);
      setPinState(pinStatus);
      setStatus('authenticated');
    } catch {
      await persistTokens(null);
      clear();
      return;
    }
    try {
      await reloadAccountData();
    } catch {
      // Account-specific screens expose the error and can retry.
    }
  }, [clear, reloadAccountData]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      const tokens = await hydrateTokens();
      if (cancelled) return;
      if (!tokens) {
        setUser(null);
        setWalletState(null);
        setPinState(null);
        setStatus('unauthenticated');
        return;
      }

      try {
        const [me, pinStatus] = await Promise.all([api.fetchMe(), api.fetchPinStatus()]);
        if (cancelled) return;
        setUser(me.user);
        setWalletState(me.wallet);
        setPinState(pinStatus);
        setStatus('authenticated');
      } catch {
        await persistTokens(null);
        if (!cancelled) {
          setUser(null);
          setWalletState(null);
          setPinState(null);
          setStatus('unauthenticated');
        }
        return;
      }
      if (!cancelled) {
        try {
          await reloadAccountData();
        } catch {
          // Account-specific screens expose accountDataError and can retry.
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [reloadAccountData]);

  const signIn = useCallback(async (session: AuthSession): Promise<PinStatus> => {
    await persistTokens(session.tokens);
    setUser(session.user);
    setWalletState(session.wallet);
    setStatus('authenticated');
    try {
      await reloadAccountData();
    } catch {
      // Account-specific screens expose the error and can retry.
    }
    try {
      const pinStatus = await api.fetchPinStatus();
      setPinState(pinStatus);
      return pinStatus;
    } catch {
      const fallback: PinStatus = { pinSet: false, lockedUntil: null };
      setPinState(fallback);
      return fallback;
    }
  }, [reloadAccountData]);

  const updateProfile = useCallback(async (input: UpdateAccountProfileInput) => {
    const profile = await api.updateAccountProfile(input);
    setAccountProfile(profile);
  }, []);

  const removeDevice = useCallback(async (id: string) => {
    await api.removeTrustedDevice(id);
    setDevices((current) => current.filter((device) => device.id !== id));
  }, []);

  const updateNotificationPreferences = useCallback(
    async (input: UpdateNotificationPreferencesInput) => {
      const preferences = await api.updateNotificationPreferences(input);
      setNotificationPreferences(preferences);
    },
    []
  );

  const setBiometricsEnabled = useCallback((enabled: boolean) => {
    setBiometricsEnabledState(enabled);
  }, []);

  const signOut = useCallback(async () => {
    await callLogout();
    await persistTokens(null);
    clear();
  }, [clear]);

  const setWallet = useCallback((next: WalletAccount) => setWalletState(next), []);
  const setPin = useCallback((next: PinStatus) => setPinState(next), []);

  const value = useMemo<SessionValue>(
    () => ({
      status,
      user,
      wallet,
      pin,
      accountProfile,
      devices,
      notificationPreferences,
      accountDataError,
      biometricsEnabled,
      signIn,
      signOut,
      reload,
      reloadAccountData,
      updateProfile,
      removeDevice,
      updateNotificationPreferences,
      setBiometricsEnabled,
      setWallet,
      setPin,
    }),
    [
      status,
      user,
      wallet,
      pin,
      accountProfile,
      devices,
      notificationPreferences,
      accountDataError,
      biometricsEnabled,
      signIn,
      signOut,
      reload,
      reloadAccountData,
      updateProfile,
      removeDevice,
      updateNotificationPreferences,
      setBiometricsEnabled,
      setWallet,
      setPin,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
