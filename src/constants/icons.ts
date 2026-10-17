import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

/**
 * Single source of truth for every glyph in the app.
 *
 * `AppIcon` renders these; nothing else should reference `SymbolView` directly.
 * Keys are semantic, values map one design idea to an SF Symbol (iOS) and a
 * Material Symbol (Android + web).
 */
export const ICONS = {
  // Navigation
  home: { ios: 'house.fill', android: 'home' },
  homeOutline: { ios: 'house', android: 'home' },
  payments: { ios: 'creditcard.fill', android: 'payments' },
  paymentsOutline: { ios: 'creditcard', android: 'account_balance_wallet' },
  transactions: { ios: 'list.bullet.rectangle', android: 'receipt_long' },
  transactionsOutline: { ios: 'list.bullet.rectangle', android: 'receipt_long' },
  profile: { ios: 'person.crop.circle.fill', android: 'person' },
  profileOutline: { ios: 'person.crop.circle', android: 'person' },

  // Money movement
  send: { ios: 'arrow.up.right', android: 'arrow_upward' },
  receive: { ios: 'arrow.down.left', android: 'arrow_downward' },
  pay: { ios: 'storefront.fill', android: 'storefront' },
  request: { ios: 'hand.raised.fill', android: 'how_to_reg' },
  wallet: { ios: 'wallet.bifold.fill', android: 'account_balance_wallet' },
  copy: { ios: 'doc.on.doc', android: 'content_copy' },
  deposit: { ios: 'arrow.down.to.line', android: 'south_west' },
  withdraw: { ios: 'arrow.up.to.line', android: 'north_east' },
  transfer: { ios: 'arrow.left.arrow.right', android: 'swap_horiz' },
  requestSend: { ios: 'paperplane.fill', android: 'send_money' },

  // Chrome
  notification: { ios: 'bell.fill', android: 'notifications' },
  notificationOutline: { ios: 'bell', android: 'notifications_none' },
  notificationActive: { ios: 'bell.badge.fill', android: 'notifications_active' },
  chevronRight: { ios: 'chevron.right', android: 'chevron_right' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  chevronLeft: { ios: 'chevron.left', android: 'chevron_left' },
  chevronDown: { ios: 'chevron.down', android: 'keyboard_arrow_down' },
  externalLink: { ios: 'arrow.up.right.square', android: 'open_in_new' },
  more: { ios: 'ellipsis', android: 'more_horiz' },
  close: { ios: 'xmark', android: 'close' },
  eye: { ios: 'eye.fill', android: 'visibility' },
  eyeOff: { ios: 'eye.slash.fill', android: 'visibility_off' },
  search: { ios: 'magnifyingglass', android: 'search' },
  filter: { ios: 'line.3.horizontal.decrease.circle', android: 'tune' },
  sort: { ios: 'arrow.up.arrow.down', android: 'swap_vert' },
  check: { ios: 'checkmark', android: 'check' },
  plus: { ios: 'plus', android: 'add' },

  // Profile / settings
  security: { ios: 'lock.shield.fill', android: 'shield_lock' },
  pin: { ios: 'lock.fill', android: 'lock' },
  phone: { ios: 'phone.fill', android: 'phone' },
  email: { ios: 'envelope.fill', android: 'mail' },
  id: { ios: 'person.text.rectangle.fill', android: 'badge' },
  appearance: { ios: 'circle.lefthalf.filled', android: 'contrast' },
  appearanceDark: { ios: 'moon.fill', android: 'dark_mode' },
  appearanceLight: { ios: 'sun.max.fill', android: 'light_mode' },
  appearanceSystem: { ios: 'circle.lefthalf.filled', android: 'routine' },
  notificationsSetting: { ios: 'bell.badge.fill', android: 'notifications_active' },
  help: { ios: 'questionmark.circle.fill', android: 'help_center' },
  info: { ios: 'info.circle.fill', android: 'info' },
  about: { ios: 'sparkles', android: 'info_outline' },
  logout: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout' },
  language: { ios: 'globe', android: 'language' },
  edit: { ios: 'pencil', android: 'edit' },
  biometrics: { ios: 'touchid', android: 'fingerprint' },
  devices: { ios: 'laptopcomputer.and.iphone', android: 'devices' },
  trash: { ios: 'trash', android: 'delete' },
  camera: { ios: 'camera.fill', android: 'photo_camera' },
  gallery: { ios: 'photo.on.rectangle', android: 'photo_library' },

  // States
  success: { ios: 'checkmark.circle.fill', android: 'check_circle' },
  pending: { ios: 'clock.fill', android: 'schedule' },
  failed: { ios: 'xmark.circle.fill', android: 'cancel' },
  warning: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
  emptyInbox: { ios: 'tray', android: 'inbox' },
  receipt: { ios: 'doc.text.fill', android: 'receipt_long' },
  qrCode: { ios: 'qrcode', android: 'qr_code_scanner' },
} as const satisfies Record<string, { ios: SFSymbol; android: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;