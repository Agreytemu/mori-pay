/**
 * Safe JSON serialisation for `bigint` money columns.
 *
 * Postgres money columns are `BigInt` whole TZS. Almost all values fit safely
 * in a JavaScript `number`, and the public API contract exposes them as
 * numbers, so we keep that for in-range values. Values that would lose
 * precision are emitted as decimal strings instead of silently corrupting the
 * amount, which is the only safe choice for financial data.
 */

/** Largest integer JavaScript can represent exactly. */
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);

export function serializeBigInt(value: bigint): number | string {
  if (value <= MAX_SAFE && value >= MIN_SAFE) {
    return Number(value);
  }
  return value.toString();
}

/**
 * Installs the shared `BigInt#toJSON` used by the HTTP layer. Kept explicit so
 * tests can assert the precision-preserving behaviour directly.
 */
export function installBigIntJsonSerialization(): void {
  (BigInt.prototype as unknown as { toJSON: () => number | string }).toJSON =
    function (this: bigint) {
      return serializeBigInt(this);
    };
}
