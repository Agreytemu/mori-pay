/**
 * Presentation-only date helpers.
 *
 * Formatted with fixed English month/day tables instead of `Intl` so output is
 * identical on every Hermes build and can be localised in one place later.
 */

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const DAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** `14:32` in the device's 24-hour local time. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `12 Mar 2026`. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/** `Thursday, 12 March 2026`. */
export function formatLongDate(iso: string): string {
  const date = new Date(iso);
  return `${DAYS_LONG[date.getDay()]}, ${date.getDate()} ${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

/** `12 Mar 2026 \u00B7 14:32` */
export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} \u00B7 ${formatTime(iso)}`;
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** `Today`, `Yesterday`, or a date. Used for list section headings. */
export function formatDayHeading(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  return `${DAYS_LONG[date.getDay()]}, ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** `Today \u00B7 14:32`, `12 Mar 2026 \u00B7 09:05`. */
export function formatRelativeDateTime(iso: string): string {
  return `${formatDayHeading(iso)} \u00B7 ${formatTime(iso)}`;
}

/** Time-of-day greeting used by the home header. */
export function getTimeGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 16) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
}
