import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

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
export type AppLockDelay = 'immediate' | 'one-minute';

export type SessionValue = {
  status: SessionStatus;
  user: AuthUser | null;
  wallet: WalletAccount | null;
  pin: PinStatus | null;
  accountProfile: AccountProfile | null;
  devices: TrustedDevice[];
  notificationPreferences: NotificationPreference | null;
  accountDataError: Error | null;
  appLockEnabled: boolean;
  appLockDelay: AppLockDelay;
  appLockReady: boolean;
  appLockStorageError: Error | null;
  isAppLocked: boolean;
  signIn: (session: AuthSession) => Promise<PinStatus>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
  reloadAccountData: () => Promise<void>;
  updateProfile: (input: UpdateAccountProfileInput) => Promise<void>;
  removeDevice: (id: string) => Promise<void>;
  updateNotificationPreferences: (input: UpdateNotificationPreferencesInput) => Promise<void>;
  setAppLockEnabled: (enabled: boolean) => Promise<void>;
  setAppLockDelay: (delay: AppLockDelay) => Promise<void>;
  unlockApp: () => void;
  reloadAppLock: () => Promise<void>;
  setWallet: (wallet: WalletAccount) => void;
  setPin: (pin: PinStatus) => void;
};

const SessionContext = createContext<SessionValue | null>(null);
const APP_LOCK_KEY = 'mori-pay-app-lock-enabled';
const APP_LOCK_DELAY_KEY = 'mori-pay-app-lock-delay';
const APP_LOCK_DELAY_MS = 60_000;

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
  const [appLockEnabled, setAppLockEnabledState] = useState(false);
  const [appLockDelay, setAppLockDelayState] = useState<AppLockDelay>('immediate');
  const [appLockReady, setAppLockReady] = useState(false);
  const [appLockStorageError, setAppLockStorageError] = useState<Error | null>(null);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const appLockEnabledRef = useRef(false);
  const appLockDelayRef = useRef<AppLockDelay>('immediate');
  const backgroundedAtRef = useRef<number | null>(null);
  const statusRef = useRef<SessionStatus>('loading');

  const reloadAppLock = useCallback(async () => {
    setAppLockReady(false);
    setAppLockStorageError(null);
    if (Platform.OS === 'web') {
      appLockEnabledRef.current = false;
      appLockDelayRef.current = 'immediate';
      setAppLockEnabledState(false);
      setAppLockDelayState('immediate');
      setIsAppLocked(false);
      setAppLockReady(true);
      return;
    }
    try {
      const [storedEnabled, storedDelay] = await Promise.all([
        SecureStore.getItemAsync(APP_LOCK_KEY),
        SecureStore.getItemAsync(APP_LOCK_DELAY_KEY),
      ]);
      const enabled = storedEnabled === 'true';
      const delay: AppLockDelay = storedDelay === 'one-minute' ? 'one-minute' : 'immediate';
      appLockEnabledRef.current = enabled;
      appLockDelayRef.current = delay;
      setAppLockEnabledState(enabled);
      setAppLockDelayState(delay);
      setIsAppLocked(enabled && statusRef.current === 'authenticated');
    } catch (error) {
      setAppLockStorageError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setAppLockReady(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [storedEnabled, storedDelay] =
          Platform.OS === 'web'
            ? [null, null]
            : await Promise.all([
                SecureStore.getItemAsync(APP_LOCK_KEY),
                SecureStore.getItemAsync(APP_LOCK_DELAY_KEY),
              ]);
        const enabled = storedEnabled === 'true';
        const delay: AppLockDelay = storedDelay === 'one-minute' ? 'one-minute' : 'immediate';
        if (cancelled) return;
        appLockEnabledRef.current = enabled;
        appLockDelayRef.current = delay;
        setAppLockEnabledState(enabled);
        setAppLockDelayState(delay);
        setIsAppLocked(enabled && statusRef.current === 'authenticated');
        setAppLockStorageError(null);
      } catch (error) {
        if (!cancelled) {
          setAppLockStorageError(error instanceof Error ? error : new Error(String(error)));
        }
      } finally {
        if (!cancelled) setAppLockReady(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    appLockEnabledRef.current = appLockEnabled;
    statusRef.current = status;
  }, [appLockEnabled, status]);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && previousState === 'active') {
        backgroundedAtRef.current = Date.now();
        if (
          appLockEnabledRef.current &&
          appLockDelayRef.current === 'immediate' &&
          statusRef.current === 'authenticated'
        ) {
          setIsAppLocked(true);
        }
      } else if (nextState === 'active' && previousState !== 'active') {
        const backgroundedAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (
          backgroundedAt !== null &&
          appLockEnabledRef.current &&
          appLockDelayRef.current === 'one-minute' &&
          statusRef.current === 'authenticated' &&
          Date.now() - backgroundedAt >= APP_LOCK_DELAY_MS
        ) {
          setIsAppLocked(true);
        }
      }
      previousState = nextState;
    });

    return () => subscription.remove();
  }, []);

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
    setIsAppLocked(false);
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
      setIsAppLocked(appLockEnabledRef.current);
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
        setIsAppLocked(appLockEnabledRef.current);
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
    setIsAppLocked(false);
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
      const fallback: PinStatus = {
        pinSet: false,
        lockedUntil: null,
        attemptsRemaining: 0,
      };
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

  const setAppLockEnabled = useCallback(async (enabled: boolean) => {
    if (Platform.OS === 'web') {
      throw new Error('App lock is available in the iOS and Android apps only.');
    }
    await SecureStore.setItemAsync(APP_LOCK_KEY, enabled ? 'true' : 'false');
    appLockEnabledRef.current = enabled;
    setAppLockEnabledState(enabled);
    setAppLockStorageError(null);
    if (!enabled) setIsAppLocked(false);
  }, []);
  const setAppLockDelay = useCallback(async (delay: AppLockDelay) => {
    if (Platform.OS === 'web') {
      throw new Error('App lock is available in the iOS and Android apps only.');
    }
    await SecureStore.setItemAsync(APP_LOCK_DELAY_KEY, delay);
    appLockDelayRef.current = delay;
    setAppLockDelayState(delay);
    setAppLockStorageError(null);
  }, []);
  const unlockApp = useCallback(() => setIsAppLocked(false), []);

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
      appLockEnabled,
      appLockDelay,
      appLockReady,
      appLockStorageError,
      isAppLocked,
      signIn,
      signOut,
      reload,
      reloadAccountData,
      updateProfile,
      removeDevice,
      updateNotificationPreferences,
      setAppLockEnabled,
      setAppLockDelay,
      unlockApp,
      reloadAppLock,
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
      appLockEnabled,
      appLockDelay,
      appLockReady,
      appLockStorageError,
      isAppLocked,
      signIn,
      signOut,
      reload,
      reloadAccountData,
      updateProfile,
      removeDevice,
      updateNotificationPreferences,
      setAppLockEnabled,
      setAppLockDelay,
      unlockApp,
      reloadAppLock,
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
