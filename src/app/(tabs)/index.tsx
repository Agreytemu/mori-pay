import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountCard } from '@/components/wallet/wallet-components';
import { PromotionBanner } from '@/components/promotions/promotion-banner';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppIllustration } from '@/components/ui/AppIllustration';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { QuickActionRow } from '@/components/ui/QuickAction';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { TransactionItem } from '@/components/ui/TransactionItem';
import type { IconName } from '@/constants/icons';
import { PAYMENT_FLOW_ROUTES } from '@/constants/payment-routes';
import { toUiTransaction, toWalletData, userStatusToAccountStatus } from '@/lib/adapters';
import { listTransactions } from '@/lib/mori-api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { useAppTheme } from '@/theme';
import { greetingFor } from '@/utils/format';
import { TRANSACTION_TYPE_LABEL } from '@/types';

const ACTIONS: { icon: IconName; label: string; onPress?: () => void }[] = [
  { icon: 'send', label: 'Send' },
  { icon: 'receive', label: 'Receive' },
  { icon: 'pay', label: 'Pay' },
  { icon: 'request', label: 'Request' },
];

export default function HomeScreen() {
  const { colors, space, radius } = useAppTheme();
  const router = useRouter();
  const { user, wallet } = useSession();

  const [balanceVisible, setBalanceVisible] = useState(true);

  const recent = useAsync(
    async () => {
      const result = await listTransactions({ limit: 4 });
      return result.items.map(toUiTransaction);
    },
    [],
    { enabled: user !== null }
  );

  const greeting = greetingFor();
  const recentItems = recent.data ?? [];
  const account = wallet
    ? toWalletData(wallet, userStatusToAccountStatus(user?.status ?? 'active'))
    : null;
  const displayName = user?.firstName ?? user?.fullName ?? 'there';

  const actions = useMemo(
    () =>
      ACTIONS.map((action) => ({
        ...action,
        onPress: () => {
          if (action.label === 'Send') {
            router.push(PAYMENT_FLOW_ROUTES.send);
          } else if (action.label === 'Receive') {
            router.push(PAYMENT_FLOW_ROUTES.receive);
          } else if (action.label === 'Request') {
            router.push(PAYMENT_FLOW_ROUTES.request);
          } else {
            router.push(PAYMENT_FLOW_ROUTES.pay);
          }
        },
      })),
    [router]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        accessibilityLabel="Home dashboard"
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: space.base,
            paddingTop: space.lg,
            paddingBottom: space.xl,
            gap: space.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.greeting}>
            <AppText variant="bodySmall" color={colors.textSecondary}>
              {greeting},
            </AppText>
            <AppText variant="title3" numberOfLines={1}>
              {displayName}
            </AppText>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => router.push('/notifications')}
            style={({ pressed }) => [
              styles.notificationButton,
              {
                width: 42,
                height: 42,
                borderRadius: radius.circle,
                backgroundColor: pressed ? colors.surfacePressed : 'transparent',
              },
            ]}>
            <AppIcon name="notificationOutline" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            onPress={() => router.push('/(tabs)/profile')}
            style={({ pressed }) => [
              styles.avatar,
              {
                width: 44,
                height: 44,
                borderRadius: radius.circle,
                backgroundColor: colors.primarySoft,
              },
              pressed && styles.pressed,
            ]}>
            <AppText variant="bodySmallStrong" color={colors.primary}>
              {(displayName ?? '?').slice(0, 1).toUpperCase()}
            </AppText>
          </Pressable>
        </View>

        {account ? (
          <AccountCard
            account={account}
            visible={balanceVisible}
            onToggleVisibility={() => setBalanceVisible((visible) => !visible)}
            onPress={() => router.push('/wallet')}
          />
        ) : (
          <AppText variant="bodySmall" color={colors.textSecondary}>
            Loading your wallet…
          </AppText>
        )}

        <PromotionBanner placement="home_banner" />

        <View
          style={[
            styles.financeBanner,
            {
              borderRadius: radius.lg,
              borderColor: colors.border,
              backgroundColor: colors.surface,
              padding: space.base,
            },
          ]}>
          <View style={styles.financeCopy}>
            <AppText variant="bodySmallStrong">Your money, in one place</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Send, receive and keep track of every payment.
            </AppText>
          </View>
          <AppIllustration name="personalFinance" width={108} height={82} />
        </View>

        <View style={styles.section}>
          <SectionHeader title="Move money" />
          <QuickActionRow actions={actions} gap={space.xs} />
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Recent activity"
            actionLabel="View all"
            onActionPress={() => router.push('/(tabs)/transactions')}
          />
          {recentItems.length > 0 ? (
            <View style={styles.activityList}>
              {recentItems.map((transaction, index) => (
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                  title={transaction.note || TRANSACTION_TYPE_LABEL[transaction.type]}
                  onPress={() =>
                    router.push({
                      pathname: '/transaction/[id]',
                      params: { id: transaction.id },
                    })
                  }
                  isLast={index === recentItems.length - 1}
                />
              ))}
            </View>
          ) : recent.loading ? (
            <EmptyState
              icon="transactions"
              title="Loading activity…"
              description="Fetching your recent transactions."
            />
          ) : (
            <EmptyState
              icon="emptyInbox"
              illustration="receipt"
              title="No transactions yet"
              description="Your recent activity will appear here."
            />
          )}
        </View>

        <View
          style={[
            styles.information,
            {
              paddingVertical: space.sm,
              gap: space.md,
            },
          ]}>
          <View style={styles.informationCopy}>
            <AppText variant="bodySmallStrong">A little reminder</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Keep your PIN private. Mori Pay will never ask you to share it.
            </AppText>
          </View>
          <AppIcon name="security" size={19} color={colors.textTertiary} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: 560,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    flex: 1,
    gap: 1,
  },
  notificationButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  section: {
    gap: 10,
  },
  activityList: {
    gap: 0,
  },
  information: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  informationCopy: {
    flex: 1,
    gap: 2,
  },
  financeBanner: {
    minHeight: 106,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    gap: 8,
  },
  financeCopy: {
    flex: 1,
    gap: 4,
  },
  pressed: {
    opacity: 0.72,
  },
});