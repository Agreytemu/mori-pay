import medium from 'expo-symbols/androidWeights/medium';
import semiBold from 'expo-symbols/androidWeights/semiBold';
import type { SymbolViewProps } from 'expo-symbols';

type PlatformSymbolNames = Required<Extract<NonNullable<SymbolViewProps['name']>, object>>;

/**
 * Central icon registry.
 *
 * Every icon in the app is declared here once, mapped to an SF Symbol for
 * Apple platforms and a Material Symbol for Android and web. Screens reference
 * icons by key (`AppIconName`) so a symbol can be swapped in one place.
 */
export const appIcons = {
  // Navigation
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  payments: { ios: 'creditcard.fill', android: 'payments', web: 'payments' },
  transactions: { ios: 'list.bullet.rectangle', android: 'receipt_long', web: 'receipt_long' },
  profile: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },

  // Money movement
  send: { ios: 'arrow.up.right.circle.fill', android: 'arrow_upward', web: 'arrow_upward' },
  receive: { ios: 'arrow.down.left.circle.fill', android: 'arrow_downward', web: 'arrow_downward' },
  request: { ios: 'questionmark.bubble.fill', android: 'chat', web: 'chat' },
  pay: { ios: 'qrcode.viewfinder', android: 'qr_code_scanner', web: 'qr_code_scanner' },
  wallet: { ios: 'wallet.pass.fill', android: 'account_balance_wallet', web: 'account_balance_wallet' },
  bank: { ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' },
  card: { ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' },
  phone: { ios: 'phone.fill', android: 'call', web: 'call' },
  merchant: { ios: 'storefront.fill', android: 'storefront', web: 'storefront' },
  transfer: { ios: 'arrow.left.arrow.right', android: 'swap_horiz', web: 'swap_horiz' },

  // Transaction categories
  moneyIn: { ios: 'arrow.down.left.circle.fill', android: 'call_received', web: 'call_received' },
  moneyOut: { ios: 'arrow.up.right.circle.fill', android: 'arrow_upward', web: 'arrow_upward' },
  airtime: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
  cashOut: { ios: 'banknote.fill', android: 'payments', web: 'payments' },

  // Chrome and utilities
  bell: { ios: 'bell.badge.fill', android: 'notifications', web: 'notifications' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  filter: { ios: 'line.3.horizontal.decrease.circle', android: 'filter_list', web: 'filter_list' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  eye: { ios: 'eye.fill', android: 'visibility', web: 'visibility' },
  eyeOff: { ios: 'eye.slash.fill', android: 'visibility_off', web: 'visibility_off' },
  copy: { ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' },
  plus: { ios: 'plus', android: 'add', web: 'add' },

  // Profile / settings
  personalInfo: { ios: 'person.text.rectangle.fill', android: 'badge', web: 'badge' },
  security: { ios: 'lock.shield.fill', android: 'shield_lock', web: 'shield_lock' },
  notifications: { ios: 'bell.fill', android: 'notifications', web: 'notifications' },
  appearance: { ios: 'circle.lefthalf.filled', android: 'contrast', web: 'contrast' },
  help: { ios: 'questionmark.circle.fill', android: 'help', web: 'help' },
  about: { ios: 'info.circle.fill', android: 'info', web: 'info' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  delete: { ios: 'trash.fill', android: 'delete', web: 'delete' },

  // Feedback states
  success: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  pending: { ios: 'clock.fill', android: 'schedule', web: 'schedule' },
  failed: { ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' },
  emptyInbox: { ios: 'tray', android: 'inbox', web: 'inbox' },
  errorState: { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' },
} as const satisfies Record<string, PlatformSymbolNames>;

export type AppIconName = keyof typeof appIcons;

/** Symbol weights used across the app, mapped per platform. */
export const iconWeights = {
  regular: undefined,
  medium: { ios: 'medium', android: medium },
  semibold: { ios: 'semibold', android: semiBold },
} as const;

export type AppIconWeight = keyof typeof iconWeights;
