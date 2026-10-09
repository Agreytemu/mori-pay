/**
 * Temporary frontend data — milestone 1.
 *
 * Screens import from this barrel only. When the backend is implemented,
 * delete the `mock-*` files, add a `api` folder of query hooks that return the
 * same types, and leave this file re-exporting from there. No screen changes.
 */
export {
  getMockAccount,
  getMockNotifications,
  getMockNotificationPreferences,
  getMockSecurityState,
} from '@/data/mock-account';
export { getMockTransactions } from '@/data/mock-transactions';
export { PAYMENT_ACTIONS } from '@/data/payment-actions';