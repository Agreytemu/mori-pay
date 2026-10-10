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
  PinStatus,
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
  signIn: (session: AuthSession) => Promise<PinStatus>;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
  setWallet: (wallet: WalletAccount) => void;
  setPin: (pin: PinStatus) => void;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [wallet, setWalletState] = useState<WalletAccount | null>(null);
  const [pin, setPinState] = useState<PinStatus | null>(null);

  const clear = useCallback(() => {
    setUser(null);
    setWalletState(null);
    setPinState(null);
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
    }
  }, [clear]);

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
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (session: AuthSession): Promise<PinStatus> => {
    await persistTokens(session.tokens);
    setUser(session.user);
    setWalletState(session.wallet);
    setStatus('authenticated');
    try {
      const pinStatus = await api.fetchPinStatus();
      setPinState(pinStatus);
      return pinStatus;
    } catch {
      const fallback: PinStatus = { pinSet: false, lockedUntil: null };
      setPinState(fallback);
      return fallback;
    }
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
      signIn,
      signOut,
      reload,
      setWallet,
      setPin,
    }),
    [status, user, wallet, pin, signIn, signOut, reload, setWallet, setPin]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
}
