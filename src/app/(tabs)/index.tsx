import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountCard } from '@/components/wallet/wallet-components';
import { AppDialog } from '@/components/ui/app-dialog';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { QuickActionRow } from '@/components/ui/QuickAction';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { TransactionItem } from '@/components/ui/TransactionItem';
import { HOME_ACTIONS, getMockHomeData } from '@/data/mock-home';
import { WALLET_ACCOUNT } from '@/data/wallet-account';
import { useAppTheme } from '@/theme';
import { formatDateTime, greetingFor } from '@/utils/format';

export default function HomeScreen() {
  const { colors, space, radius } = useAppTheme();
  const router = useRouter();
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);
  const data = useMemo(() => getMockHomeData(), []);
  const greeting = greetingFor();

  const showComingSoon = (feature: string) =>
    setDialog({ title: feature, message: 'This feature will be available soon.' });

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        accessibilityLabel="Home dashboard"
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: space.base,
            paddingTop: space.md,
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
              {data.user.displayName}
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
            onPress={() => showComingSoon('Profile')}
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
              {data.user.displayName.slice(0, 1).toUpperCase()}
            </AppText>
          </Pressable>
        </View>

        <AccountCard
          account={WALLET_ACCOUNT}
          visible={balanceVisible}
          onToggleVisibility={() => setBalanceVisible((visible) => !visible)}
          onPress={() => router.push('/wallet')}
        />

        <View style={styles.section}>
          <SectionHeader title="Move money" />
          <QuickActionRow
            actions={HOME_ACTIONS.map((action) => ({
              ...action,
              onPress: () => showComingSoon(action.label),
            }))}
            gap={space.xs}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Recent activity"
            actionLabel="View all"
            onActionPress={() => showComingSoon('Transactions')}
          />
          {data.transactions.length > 0 ? (
            <View style={styles.activityList}>
              {data.transactions.map((transaction, index) => (
                <TransactionItem
                  key={transaction.id}
                  transaction={transaction}
                  title={transaction.note || transaction.typeLabel}
                  onPress={() =>
                    setDialog({
                      title: transaction.note || transaction.typeLabel,
                      message: `${transaction.counterparty}\n${formatDateTime(
                        transaction.createdAt
                      )}`,
                    })
                  }
                  isLast={index === data.transactions.length - 1}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="emptyInbox"
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
      <AppDialog
        visible={dialog !== null}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        onClose={() => setDialog(null)}
        testID="home-action-dialog"
      />
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
  pressed: {
    opacity: 0.72,
  },
});
