/**
 * Generic async view state.
 *
 * Screens render loading / error / ready / empty branches from this type, so a
 * real API call can be dropped in later without restructuring the UI.
 */
export type LoadStatus = 'loading' | 'error' | 'ready';

export type Loadable<T> = {
  status: LoadStatus;
  data: T;
  /** Optional user-facing error message. */
  errorMessage?: string;
};
