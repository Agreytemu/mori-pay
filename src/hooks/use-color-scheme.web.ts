import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-color-scheme: dark)';

function getSnapshot(): 'light' | 'dark' {
  return typeof window !== 'undefined' && window.matchMedia?.(QUERY).matches
    ? 'dark'
    : 'light';
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const mediaQuery = window.matchMedia?.(QUERY);
  if (!mediaQuery) {
    return () => {};
  }

  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

export function useColorScheme() {
  return useSyncExternalStore(subscribe, getSnapshot, () => 'light');
}
