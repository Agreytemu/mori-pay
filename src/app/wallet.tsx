import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AccountCard,
  AccountInfoRow,
  WalletAction,
  WalletActivityItem,
} from '@/components/wallet/wallet-components';
import { PAYMENT_FLOW_ROUTES } from '@/constants/payment-routes';
import { AppDialog } from '@/components/ui/app-dialog';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppIllustration } from '@/components/ui/AppIllustration';
import { AppText } from '@/components/ui/AppText';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { toWalletActivity, toWalletData, userStatusToAccountStatus } from '@/lib/adapters';
import { listTransactions } from '@/lib/mori-api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { useAppTheme } from '@/theme';

export function WalletScreen({ isTab = false }: { isTab?: boolean }) {
  const router = useRouter();
  const { colors, space, radius } = useAppTheme();
  const { user, wallet } = useSession();

  const [balanceVisible, setBalanceVisible] = useState(true);
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);

  const activity = useAsync(
    async () => {
      const result = await listTransactions({ limit: 5 });
      return result.items.map(toWalletActivity);
    },
    [],
    { enabled: user !== null }
  );

  const account = wallet
    ? toWalletData(wallet, userStatusToAccountStatus(user?.status ?? 'active'))
    : null;

  const copyAccountNumber = async () => {
    if (!account) return;
    try {
      await Clipboard.setStringAsync(account.accountNumber);
      setDialog({ title: 'Copied', message: 'Account number copied to clipboard.' });
    } catch (error) {
      setDialog({
        title: 'Could not copy',
        message:
          error instanceof Error
            ? `Clipboard access failed: ${error.message}`
            : 'Clipboard access failed. Please try again.',
      });
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: space.base, paddingTop: space.sm, paddingBottom: space.xl, gap: space.lg },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {!isTab ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.headerButton,
                {
                  borderRadius: radius.circle,
                  backgroundColor: pressed ? colors.surfacePressed : colors.surface,
                  borderColor: colors.border,
                },
              ]}>
              <AppIcon name="chevronLeft" size={19} color={colors.text} />
            </Pressable>
          ) : null}
          <View style={styles.headerCopy}>
            <AppText variant="title2">Wallet</AppText>
            <AppText variant="caption" color={colors.textSecondary}>Account details</AppText>
          </View>
        </View>

        {account ? (
          <>
            <AccountCard
              account={account}
              visible={balanceVisible}
              onToggleVisibility={() => setBalanceVisible((visible) => !visible)}
              onPress={() => setBalanceVisible((visible) => !visible)}
            />

            <View
              style={[
                styles.walletBanner,
                {
                  borderRadius: radius.lg,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  padding: space.base,
                },
              ]}>
              <View style={styles.walletBannerCopy}>
                <AppText variant="bodySmallStrong">Your wallet</AppText>
                <AppText variant="caption" color={colors.textSecondary}>
                  Manage your balance and everyday money.
                </AppText>
              </View>
              <AppIllustration name="wallet" width={104} height={82} />
            </View>

            <View style={styles.actionsSection}>
              <SectionHeader title="Wallet actions" />
              <View style={styles.actionRow}>
                <WalletAction label="Deposit" icon="deposit" onPress={() => router.push('/wallet/deposit')} />
                <WalletAction label="Withdraw" icon="withdraw" onPress={() => router.push('/wallet/withdraw')} />
                <WalletAction
                  label="Send"
                  icon="send"
                  onPress={() => router.push(PAYMENT_FLOW_ROUTES.send)}
                />
                <WalletAction
                  label="Receive"
                  icon="receive"
                  onPress={() => router.push(PAYMENT_FLOW_ROUTES.receive)}
                />
              </View>
            </View>

            <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
              <SectionHeader title="Account information" />
              <AccountInfoRow label="Account number" value={account.accountNumber} icon="copy" onPress={copyAccountNumber} />
              <AccountInfoRow label="Phone number" value={account.phoneNumber} icon="phone" />
              <AccountInfoRow label="Account type" value={account.accountType} icon="wallet" />
              <AccountInfoRow label="Date opened" value={account.openedDate} icon="transactions" />
              <AccountInfoRow label="Status" value={account.status === 'active' ? 'Active' : account.status} icon="success" />
            </View>

            <View style={styles.activitySection}>
              <SectionHeader
                title="Wallet activity"
                actionLabel="View all"
                onActionPress={() => router.push('/(tabs)/transactions')}
              />
              <View style={styles.activityList}>
                {(activity.data ?? []).map((transaction) => (
                  <WalletActivityItem key={transaction.id} item={transaction} />
                ))}
                {!activity.loading && activity.error ? (
                  <AppText variant="caption" color={colors.error}>Could not load recent activity.</AppText>
                ) : null}
              </View>
            </View>
          </>
        ) : (
          <AppText variant="bodySmall" color={colors.textSecondary}>
            Loading your wallet…
          </AppText>
        )}
      </ScrollView>
      <AppDialog
        visible={dialog !== null}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        onClose={() => setDialog(null)}
        testID="wallet-dialog"
      />
    </SafeAreaView>
  );
}

export default WalletScreen;

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  headerButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, gap: 1 },
  walletBanner: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1 },
  walletBannerCopy: { flex: 1, gap: 4 },
  actionsSection: { gap: 10 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  infoCard: { paddingHorizontal: 16, paddingTop: 16 },
  activitySection: { gap: 8 },
  activityList: { gap: 2 },
});