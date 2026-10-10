import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Small data-fetching primitive: runs a fetcher on mount and whenever `deps`
 * change, exposing `data` / `error` / `loading` plus a manual `refetch`.
 *
 * Stale responses are ignored so a slow request can never overwrite a newer
 * one, and the fetcher is always the latest closure.
 */
export type AsyncState<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => Promise<T | null>;
};

export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[] = [],
  options: { enabled?: boolean } = {}
): AsyncState<T> {
  const { enabled = true } = options;

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(enabled);

  /** Guards against out-of-order results from concurrent runs. */
  const runIdRef = useRef(0);

  const run = useCallback(async (): Promise<T | null> => {
    const runId = ++runIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (runId === runIdRef.current) {
        setData(result);
        setLoading(false);
      }
      return result;
    } catch (err) {
      if (runId === runIdRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const runId = ++runIdRef.current;
    fetcherRef
      .current()
      .then((result) => {
        if (runId === runIdRef.current) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (runId === runIdRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });
    return () => {
      runIdRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, error, loading, refetch: run };
}