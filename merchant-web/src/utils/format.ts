import type { MerchantPortalQrCode } from '../types';

export const timezone = 'Africa/Dar_es_Salaam';

export function todayInTanzania(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function toBoundary(value: string, end = false): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}+03:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function formatMoney(value: number, currency = 'TZS'): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(value?: string): string {
  if (!value || Number.isNaN(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('en-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}

export function qrStatus(qr: MerchantPortalQrCode): string {
  if (qr.revokedAt) return 'Cancelled';
  if (qr.expiresAt && Date.parse(qr.expiresAt) <= Date.now()) return 'Expired';
  if (qr.kind === 'fixed' && !qr.reusable && qr.uses > 0) return 'Used';
  return 'Active';
}

export function labelValue(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
