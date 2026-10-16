/**
 * Raw colour primitives for Mori Pay.
 *
 * These are the only literal hex values in the codebase. Semantic tokens that
 * components consume live in `semantic.ts` and map these primitives per scheme.
 * Never import from this file inside a component or screen.
 */

/** Neutral / greyscale ramp. */
export const neutral = {
  0: '#FFFFFF',
  50: '#F7F8FA',
  100: '#F0F2F5',
  200: '#E4E7EC',
  300: '#D3D8DF',
  400: '#A5AEBA',
  500: '#7A8493',
  600: '#5B6575',
  700: '#3F4855',
  800: '#262C36',
  850: '#1A212B',
  900: '#12171F',
  950: '#0A0E14',
} as const;

/**
 * Brand ramp. A deep teal reads as "money handled carefully" without copying the
 * green of any specific mobile money operator.
 */
export const brand = {
  50: '#EAF7F5',
  100: '#CDEBE6',
  200: '#9BD8CF',
  300: '#63BFB2',
  400: '#34A596',
  500: '#1D8A7C',
  600: '#0E7367',
  700: '#0B5C53',
  800: '#094941',
  900: '#073733',
} as const;

/** High-contrast motion colours used by transaction feedback. */
export const feedback = {
  navy: '#07162E',
  electricBlue: '#1465FF',
  cyan: '#00CDEF',
} as const;

/** Semantic state ramps used for status badges and inline feedback. */
export const positive = {
  50: '#E9F7EE',
  500: '#1E8E4E',
  600: '#15713E',
  700: '#0F5A33',
} as const;

export const caution = {
  50: '#FEF4E6',
  500: '#C2760C',
  600: '#9A5C07',
  700: '#7A4806',
} as const;

export const critical = {
  50: '#FDECEA',
  500: '#C4342A',
  600: '#A32A21',
  700: '#83211A',
} as const;

export const informational = {
  50: '#EAF0FD',
  500: '#2B5FD9',
  600: '#2149AC',
  700: '#1A3A89',
} as const;

export const palette = {
  neutral,
  brand,
  feedback,
  positive,
  caution,
  critical,
  informational,
} as const;

export type NeutralTone = keyof typeof neutral;
export type BrandTone = keyof typeof brand;