import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { SearchField } from '@/components/ui/search-field';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBanner } from '@/components/profile/profile-components';
import { TransactionItem } from '@/components/ui/TransactionItem';
import { SecondaryButton } from '@/components/ui/button';
import type { Transaction } from '@/types/transaction';
import { toUiTransaction } from '@/lib/adapters';
import { listTransactions } from '@/lib/mori-api';
import { useAppTheme } from '@/theme';

export default function TransactionsScreen() {
  const { colors, space } = useAppTheme();
  const router = useRouter();

  const [items, setItems] = useState<Transaction[]>([]);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPage = useCallback(
    async (next: string | null) => {
      try {
        const result = await listTransactions({ q: query || undefined, cursor: next, limit: 25 });
        setItems((current) => {
          const known = new Set(current.map((item) => item.id));
          return [
            ...current,
            ...result.items.map(toUiTransaction).filter((item) => !known.has(item.id)),
          ];
        });
        setCursor(result.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load more transactions.');
      }
    },
    [query]
  );

  const runInitial = useCallback(
    async (q: string) => {
      setLoading(true);
      setError(null);
      setItems([]);
      setCursor(null);
      const snapshot = await listTransactions({ q: q || undefined, limit: 25 }).then((r) => ({
        items: r.items.map(toUiTransaction),
        nextCursor: r.nextCursor,
      }));
      setItems(snapshot.items);
      setCursor(snapshot.nextCursor);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void runInitial(query.trim()), 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, runInitial]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await runInitial(query.trim());
    setRefreshing(false);
  }, [query, runInitial]);

  const onLoadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    await loadPage(cursor);
    setLoadingMore(false);
  }, [cursor, loadingMore, loadPage]);

  const hasItems = items.length > 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.content, { paddingHorizontal: space.base, paddingTop: space.sm, gap: space.md }]}>
        <View>
          <AppText variant="title2">Transactions</AppText>
          <AppText variant="caption" color={colors.textSecondary}>History of money in and out</AppText>
        </View>

        <SearchField value={query} onChangeText={setQuery} placeholder="Search by name, note or reference" />

        {error ? <StatusBanner tone="error" title="Could not load" message={error} onDismiss={() => setError(null)} /> : null}

        {loading ? (
          <EmptyState icon="transactions" title="Loading…" description="Fetching your transactions." />
        ) : hasItems ? (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item, index }) => (
              <TransactionItem
                transaction={item}
                isLast={index === items.length - 1}
                showStatus
                onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
              />
            )}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />}
            ListFooterComponent={
              cursor ? (
                <SecondaryButton
                  label={loadingMore ? 'Loading…' : 'Load more'}
                  size="sm"
                  disabled={loadingMore}
                  onPress={() => void onLoadMore()}
                />
              ) : null
            }
          />
        ) : (
          <View style={styles.empty}>
            <EmptyState
              icon="emptyInbox"
              title={query ? 'Nothing matches' : 'No transactions yet'}
              description={
                query
                  ? 'Try a different search term.'
                  : 'Your wallet activity will appear here once you move money.'
              }
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flex: 1 },
  list: { gap: 0, paddingBottom: 24 },
  empty: { flex: 1 },
});