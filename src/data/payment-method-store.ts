import { useEffect, useSyncExternalStore } from 'react';
import type { SavePaymentMethodInput, SavedPaymentMethod as ApiPaymentMethod } from '@mori-pay/contracts';

import type { SavedPaymentMethod } from '@/data/mock-payment-methods';
import { toSavedPaymentMethod } from '@/lib/adapters';
import {
  listSavedPaymentMethods as fetchMethods,
  removeSavedPaymentMethod as deleteMethod,
  savePaymentMethod as createMethod,
  updateSavedPaymentMethod as patchMethod,
} from '@/lib/mori-api';
import { useSession } from '@/lib/session';

type StoreState = {
  userId: string | null;
  methods: SavedPaymentMethod[];
  loading: boolean;
  error: Error | null;
};

let state: StoreState = { userId: null, methods: [], loading: false, error: null };
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function setState(next: StoreState) {
  state = next;
  notify();
}

export function subscribePaymentMethods(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPaymentMethodsState() {
  return state;
}

export function usePaymentMethods() {
  const { user } = useSession();
  const userId = user?.id ?? null;
  const current = useSyncExternalStore(subscribePaymentMethods, getPaymentMethodsState, getPaymentMethodsState);

  useEffect(() => {
    if (!userId) {
      setState({ userId: null, methods: [], loading: false, error: null });
      return;
    }
    if (state.userId === userId && (state.loading || !state.error && state.methods.length >= 0)) {
      if (!state.error && state.loading === false && state.methods.length >= 0) {
        void loadPaymentMethods(userId);
      }
      return;
    }
    void loadPaymentMethods(userId);
  }, [userId]);

  return current.userId === userId
    ? current
    : { userId, methods: [], loading: Boolean(userId), error: null };
}

export async function loadPaymentMethods(userId = state.userId): Promise<void> {
  if (!userId || state.loading) return;
  setState({ userId, methods: state.userId === userId ? state.methods : [], loading: true, error: null });
  try {
    const result = await fetchMethods();
    if (state.userId === userId) {
      setState({ userId, methods: result.map(toSavedPaymentMethod), loading: false, error: null });
    }
  } catch (error) {
    if (state.userId === userId) {
      setState({
        ...state,
        loading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}

function toInput(method: SavedPaymentMethod): SavePaymentMethodInput {
  return {
    kind: method.kind,
    provider: method.provider,
    lastFour: method.identifier.replace(/\D/g, '').slice(-4),
    isDefault: method.isDefault,
  };
}

function replaceMethod(method: ApiPaymentMethod) {
  if (state.userId) {
    const mapped = toSavedPaymentMethod(method);
    const methods = state.methods.some((item) => item.id === mapped.id)
      ? state.methods.map((item) => item.id === mapped.id ? mapped : { ...item, isDefault: mapped.isDefault ? false : item.isDefault })
      : [...state.methods.map((item) => ({ ...item, isDefault: mapped.isDefault ? false : item.isDefault })), mapped];
    setState({ ...state, methods, error: null });
  }
}

export async function savePaymentMethod(method: SavedPaymentMethod) {
  const input = toInput(method);
  const saved = method.id.startsWith('method-')
    ? await createMethod(input)
    : await patchMethod(method.id, input);
  replaceMethod(saved);
}

export async function setPaymentMethodDefault(id: string) {
  const method = state.methods.find((item) => item.id === id);
  if (!method) throw new Error('Payment method not found');
  const saved = await patchMethod(id, { ...toInput(method), isDefault: true });
  replaceMethod(saved);
}

export async function removePaymentMethod(id: string) {
  await deleteMethod(id);
  const methods = state.methods.filter((item) => item.id !== id);
  if (state.userId) {
    setState({ ...state, methods, error: null });
  }
}
