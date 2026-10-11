import type { Href } from 'expo-router';

export type PaymentFlow = 'send' | 'receive' | 'request' | 'pay';

export const PAYMENT_FLOW_ROUTES = {
  send: '/(tabs)/payments/send',
  receive: '/(tabs)/payments/receive',
  request: '/(tabs)/payments/request',
  pay: '/(tabs)/payments/pay',
} as const satisfies Record<PaymentFlow, Href>;
