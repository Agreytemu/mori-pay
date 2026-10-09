import { useState } from 'react';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AccountCard, AccountInfoRow, WalletAction, WalletActivityItem } from '@/components/wallet/wallet-components';
import { AppDialog } from '@/components/ui/app-dialog';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { WALLET_ACCOUNT, WALLET_ACTIVITY } from '@/data/wallet-account';
import { useAppTheme } from '@/theme';

export function WalletScreen({ isTab = false }: { isTab?: boolean }) {
  const router = useRouter();
  const { colors, space, radius } = useAppTheme();
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);

  const copyAccountNumber = async () => {
    try {
      await Clipboard.setStringAsync(WALLET_ACCOUNT.accountNumber);
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
          {isTab ? <View style={styles.headerButton} /> : (
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
          )}
          <View style={styles.headerCopy}>
            <AppText variant="title2">Wallet</AppText>
            <AppText variant="caption" color={colors.textSecondary}>Account details</AppText>
          </View>
          <View style={{ width: 42 }} />
        </View>

        <AccountCard
          account={WALLET_ACCOUNT}
          visible={balanceVisible}
          onToggleVisibility={() => setBalanceVisible((visible) => !visible)}
          onPress={() => setBalanceVisible((visible) => !visible)}
        />

        <View style={styles.actionsSection}>
          <SectionHeader title="Wallet actions" />
          <View style={styles.actionRow}>
            <WalletAction label="Deposit" icon="deposit" onPress={() => router.push('/wallet/deposit')} />
            <WalletAction label="Withdraw" icon="withdraw" onPress={() => router.push('/wallet/withdraw')} />
            <WalletAction
              label="Send"
              icon="send"
              onPress={() => router.push({ pathname: '/(tabs)/payments', params: { startFlow: 'send' } })}
            />
            <WalletAction
              label="Receive"
              icon="receive"
              onPress={() => router.push({ pathname: '/(tabs)/payments', params: { startFlow: 'receive' } })}
            />
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
          <SectionHeader title="Account information" />
          <AccountInfoRow
            label="Account number"
            value={WALLET_ACCOUNT.accountNumber}
            icon="copy"
            onPress={copyAccountNumber}
          />
          <AccountInfoRow label="Phone number" value={WALLET_ACCOUNT.phoneNumber} icon="phone" />
          <AccountInfoRow label="Account type" value={WALLET_ACCOUNT.accountType} icon="wallet" />
          <AccountInfoRow label="Date opened" value={WALLET_ACCOUNT.openedDate} icon="transactions" />
          <AccountInfoRow label="Status" value="Active" icon="success" />
        </View>

        <View style={styles.activitySection}>
          <SectionHeader
            title="Wallet activity"
            actionLabel="View all"
            onActionPress={() => router.push('/(tabs)/transactions')}
          />
          <View style={styles.activityList}>
            {WALLET_ACTIVITY.map((item) => <WalletActivityItem key={item.id} item={item} />)}
          </View>
        </View>
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
  actionsSection: { gap: 10 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  infoCard: { paddingHorizontal: 16, paddingTop: 16 },
  activitySection: { gap: 8 },
  activityList: { gap: 2 },
});
