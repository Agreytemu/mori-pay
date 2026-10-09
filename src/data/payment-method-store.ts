import { useSyncExternalStore } from 'react';

import { MOCK_SAVED_PAYMENT_METHODS, type SavedPaymentMethod } from '@/data/mock-payment-methods';

let methods = [...MOCK_SAVED_PAYMENT_METHODS];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribePaymentMethods(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPaymentMethods() {
  return methods;
}

export function usePaymentMethods() {
  return useSyncExternalStore(subscribePaymentMethods, getPaymentMethods, getPaymentMethods);
}

export function savePaymentMethod(method: SavedPaymentMethod) {
  methods = methods.some((item) => item.id === method.id)
    ? methods.map((item) => item.id === method.id ? method : item)
    : [...methods, method];
  if (method.isDefault) setPaymentMethodDefault(method.id);
  else notify();
}

export function setPaymentMethodDefault(id: string) {
  methods = methods.map((method) => ({ ...method, isDefault: method.id === id }));
  notify();
}

export function removePaymentMethod(id: string) {
  const wasDefault = methods.find((method) => method.id === id)?.isDefault;
  methods = methods.filter((method) => method.id !== id);
  if (wasDefault && methods.length) methods = methods.map((method, index) => ({ ...method, isDefault: index === 0 }));
  notify();
}

