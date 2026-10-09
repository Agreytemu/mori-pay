import { Platform, StyleSheet } from 'react-native';

/** Memoisable style factory. Mirrors `StyleSheet.create` but callable. */
export function createStyles<T extends StyleSheet.NamedStyles<T>>(factory: () => T): () => T {
  return factory;
}

/** Android/iOS elevation pair for card surfaces. */
export function cardShadow(isDark: boolean, level: 'low' | 'medium' = 'low') {
  if (isDark) {
    return {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.06)',
    };
  }
  return Platform.select({
    ios: {
      shadowColor: '#0A0E14',
      shadowOpacity: level === 'low' ? 0.06 : 0.1,
      shadowRadius: level === 'low' ? 10 : 18,
      shadowOffset: { width: 0, height: level === 'low' ? 3 : 6 },
    },
    android: { elevation: level === 'low' ? 1 : 2 },
    default: {},
  });
}

/** Groups a list of transactions into `Today` / `Yesterday` / date sections. */
export function groupByDay<T extends { createdAt: string }>(
  items: readonly T[],
  formatHeading: (iso: string) => string
): { heading: string; data: T[] }[] {
  const groups: { heading: string; data: T[] }[] = [];
  for (const item of items) {
    const heading = formatHeading(item.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.heading === heading) {
      last.data.push(item);
    } else {
      groups.push({ heading, data: [item] });
    }
  }
  return groups;
}

/** Case/diacritic-insensitive substring match across a set of fields. */
export function matchesQuery(query: string, ...fields: (string | undefined)[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field?.toLowerCase().includes(needle));
}