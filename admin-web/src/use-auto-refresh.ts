import { useEffect, useRef } from 'react';

/**
 * Repeatedly invokes `callback` on an interval so pages keep an up-to-date view
 * of server state without a manual refresh. The latest callback is always used,
 * so callers do not need to memoise it.
 */
export function useAutoRefresh(callback: () => void, intervalMs = 15_000): void {
  const latest = useRef(callback);
  latest.current = callback;

  useEffect(() => {
    const id = window.setInterval(() => {
      latest.current();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
}
