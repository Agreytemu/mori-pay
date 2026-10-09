/** Presentation helpers. Pure functions, no React, no API access. */

const CURRENCY_SYMBOL: Record<string, string> = {
  TZS: 'TZS',
  KES: 'KES',
  UGX: 'UGX',
  USD: '$',
  EUR: '€',
};

/** `1250000` → `TZS 1,250,000`. Whole numbers only; no minor units are shown. */
export function formatAmount(amount: number, currency = 'TZS'): string {
  const rounded = Math.round(amount);
  const grouped = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    useGrouping: true,
  }).format(Math.abs(rounded));
  const sign = rounded < 0 ? '-' : '';
  return `${sign}${CURRENCY_SYMBOL[currency] ?? currency} ${grouped}`;
}

/** `1250000` → `1,250,000`. Used where the currency is already labelled. */
export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(amount));
}

/** Splits a formatted amount so the currency code can be de-emphasised. */
export function splitAmount(amount: number, currency = 'TZS'): { value: string; code: string } {
  const rounded = Math.round(amount);
  return {
    value: new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.abs(rounded)),
    code: CURRENCY_SYMBOL[currency] ?? currency,
  };
}

/** `12500` → `12,500` for fee lines. */
export function formatFee(amount: number, currency = 'TZS'): string {
  return amount <= 0 ? 'Free' : formatAmount(amount, currency);
}

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dayFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const dayMonthFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
});

const weekdayFormatter = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** `Today` / `Yesterday` / `12 Mar 2026` relative to `now`. */
export function formatDateLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return weekdayFormatter.format(date);
  return dayFormatter.format(date);
}

/** Section header for grouped transaction lists. */
export function formatDayHeading(iso: string, now: Date = new Date()): string {
  return formatDateLabel(iso, now);
}

/** `14:35` */
export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/** `Today · 14:35`, used in transaction detail rows. */
export function formatDateTime(iso: string, now: Date = new Date()): string {
  return `${formatDateLabel(iso, now)} · ${formatTime(iso)}`;
}

/** `12 Mar 2026` for profile / account rows. */
export function formatDate(iso: string): string {
  return dayMonthFormatter.format(new Date(iso));
}

/** `+255 712 345 678` from `255712345678`. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length < 9) return raw;
  return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`.trim();
}

/** `+255712345678` -> `+255 ••• ••• 4821`. Only the last four digits survive. */
export function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 4) return raw;
  return `+${digits.slice(0, 3)} ••• ••• ${digits.slice(-4)}`;
}

/** First letters of up to two words, used by `Avatar`. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Time-of-day greeting for the Home header. */
export function greetingFor(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}

/** Seconds -> `2 min ago` / `3 hr ago`. */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(iso);
}

/** Percentage of a limit consumed, clamped to 0–100. */
export function progressRatio(used: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (used / total) * 100));
}