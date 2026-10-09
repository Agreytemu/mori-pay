/**
 * Presentation-only money formatting.
 *
 * No arithmetic beyond unit conversion happens here: amounts arrive as integers
 * in the currency's minor unit and leave as display strings. Rate conversion,
 * fees and balance maths belong to the backend layer in a later milestone.
 */

type CurrencyMeta = {
  symbol: string;
  fractionDigits: number;
};

const CURRENCY_META: Record<string, CurrencyMeta> = {
  TZS: { symbol: 'TSh', fractionDigits: 0 },
  KES: { symbol: 'KSh', fractionDigits: 0 },
  USD: { symbol: '$', fractionDigits: 2 },
  EUR: { symbol: '\u20AC', fractionDigits: 2 },
};

const FALLBACK_META: CurrencyMeta = { symbol: '', fractionDigits: 2 };

export function getCurrencyMeta(currency: string): CurrencyMeta {
  return CURRENCY_META[currency] ?? { ...FALLBACK_META, symbol: currency };
}

function groupThousands(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** `250000` TZS -> `TSh 250,000`. */
export function formatMoney(minor: number, currency: string): string {
  const meta = getCurrencyMeta(currency);
  const divisor = 10 ** meta.fractionDigits;
  const negative = minor < 0;
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / divisor);
  const fraction = absolute % divisor;

  const grouped = groupThousands(String(whole));
  const decimals =
    meta.fractionDigits > 0
      ? `.${String(fraction).padStart(meta.fractionDigits, '0')}`
      : '';

  const prefix = meta.symbol ? `${meta.symbol} ` : '';
  const sign = negative ? '-' : '';

  return `${sign}${prefix}${grouped}${decimals}`;
}

/** Formats an amount with an explicit sign, for ledger rows. */
export function formatSignedMoney(
  minor: number,
  currency: string,
  direction: 'credit' | 'debit'
): string {
  const formatted = formatMoney(Math.abs(minor), currency);
  return direction === 'credit' ? `+${formatted}` : `-${formatted}`;
}

/** Masks all but the last four characters of an account number. */
export function maskAccountNumber(value: string): string {
  const visible = value.slice(-4);
  return `\u2022\u2022\u2022\u2022 ${visible}`;
}
