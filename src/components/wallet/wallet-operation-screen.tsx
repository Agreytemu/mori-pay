import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppDialog } from '@/components/ui/app-dialog';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/button';
import { WALLET_ACCOUNT } from '@/data/wallet-account';
import { useAppTheme } from '@/theme';

type WalletOperation = 'deposit' | 'withdraw';

const METHODS = [
  { id: 'wallet', name: 'Wallet transfer', description: 'Demo destination', icon: 'wallet' as const },
  { id: 'bank', name: 'Bank account', description: 'Choose an account later', icon: 'payments' as const },
  { id: 'cash', name: 'Cash point', description: 'Availability shown in a future release', icon: 'receive' as const },
];

export function WalletOperationScreen({ operation }: { operation: WalletOperation }) {
  const router = useRouter();
  const { colors, space, radius } = useAppTheme();
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState(METHODS[0].id);
  const [dialogVisible, setDialogVisible] = useState(false);
  const isDeposit = operation === 'deposit';
  const title = isDeposit ? 'Deposit' : 'Withdraw';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: space.base }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Wallet"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            { borderRadius: radius.circle, backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border },
          ]}>
          <AppIcon name="chevronLeft" size={19} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <AppText variant="title2">{title}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>Wallet</AppText>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: space.base, paddingTop: space.lg, paddingBottom: space.xl, gap: space.xl },
          ]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.amountBlock}>
            <AppText variant="bodySmall" color={colors.textSecondary}>
              {isDeposit ? 'Amount to add' : 'Amount to withdraw'}
            </AppText>
            <View style={styles.amountRow}>
              <AppText variant="bodyStrong" color={colors.textSecondary}>TZS</AppText>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                keyboardType="number-pad"
                returnKeyType="done"
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
                selectionColor={colors.primary}
                style={[styles.amountInput, { color: colors.text, fontSize: 38 }]}
              />
            </View>
            <AppText variant="caption" color={colors.textTertiary}>
              This is a UI preview. Your balance will not change.
            </AppText>
          </View>

          <View style={styles.methods}>
            <AppText variant="bodySmallStrong">
              {isDeposit ? 'Payment method' : 'Destination'}
            </AppText>
            {METHODS.map((method) => {
              const selected = method.id === methodId;
              return (
                <Pressable
                  key={method.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setMethodId(method.id)}
                  style={({ pressed }) => [
                    styles.methodRow,
                    {
                      backgroundColor: pressed ? colors.surfacePressed : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                      borderWidth: selected ? 1.5 : 1,
                      borderRadius: radius.md,
                      padding: space.base,
                    },
                  ]}>
                  <View style={[styles.methodIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
                    <AppIcon name={method.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.methodCopy}>
                    <AppText variant="bodySmallStrong">{method.name}</AppText>
                    <AppText variant="caption" color={colors.textSecondary}>{method.description}</AppText>
                  </View>
                  {selected ? <AppIcon name="check" size={18} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.accountHint, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}>
            <AppIcon name="wallet" size={17} color={colors.textSecondary} />
            <AppText variant="caption" color={colors.textSecondary} style={styles.hintText}>
              Account · {WALLET_ACCOUNT.accountType} · {WALLET_ACCOUNT.accountNumber}
            </AppText>
          </View>
          <Button label="Continue" onPress={() => setDialogVisible(true)} />
        </ScrollView>
      </KeyboardAvoidingView>
      <AppDialog
        visible={dialogVisible}
        title={`${title} preview`}
        message="This action is for display only. No payment or balance change will be made."
        onClose={() => setDialogVisible(false)}
        testID="wallet-operation-dialog"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingTop: 8 },
  backButton: { width: 42, height: 42, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { gap: 1 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  amountBlock: { gap: 10 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  amountInput: { flex: 1, minWidth: 0, width: 0, fontWeight: '700', paddingVertical: 0, minHeight: 52 },
  methods: { gap: 10 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  methodCopy: { flex: 1, gap: 2 },
  accountHint: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  hintText: { flex: 1 },
});
