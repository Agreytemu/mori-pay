import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { Divider } from '@/components/ui/divider';
import { StatusBadge } from '@/components/ui/status-badge';
import { radius, spacing, useAppTheme } from '@/theme';
import type { Transaction } from '@/types/transaction';
import { formatTime } from '@/utils/format-date';
import { formatSignedMoney } from '@/utils/format-money';
import { getTransactionIcon, getTransactionTone } from '@/utils/transaction-view';

const ICON_SIZE = 40;
const ICON_INSET = ICON_SIZE + spacing.md * 2;

export type TransactionItemProps = {
  transaction: Transaction;
  onPress?: () => void;
  /** Hairline under the row — used when items are stacked in a card. */
  showDivider?: boolean;
  testID?: string;
};

/** Single ledger row: type indicator, title, amount, time and status. */
export function TransactionItem({
  transaction,
  onPress,
  showDivider = false,
  testID,
}: TransactionItemProps) {
  const { colors } = useAppTheme();
  const tone = getTransactionTone(transaction);

  const tile = (() => {
    switch (tone) {
      case 'brand':
        return { background: colors.primarySoft, foreground: colors.primary };
      case 'info':
        return { background: colors.infoSoft, foreground: colors.info };
      case 'warning':
        return { background: colors.warningSoft, foreground: colors.warning };
      case 'neutral':
      default:
        return { background: colors.surfaceMuted, foreground: colors.textSecondary };
    }
  })();

  const amountColor =
    transaction.status === 'failed' || transaction.status === 'cancelled'
      ? colors.textTertiary
      : transaction.direction === 'credit'
        ? colors.success
        : colors.text;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${transaction.counterparty}, ${formatSignedMoney(
          transaction.amount,
          transaction.currency,
          transaction.direction
        )}`}
        disabled={!onPress}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [styles.root, pressed && styles.pressed]}>
        <View
          style={[
            styles.icon,
            { backgroundColor: tile.background, borderColor: colors.border },
          ]}>
          <AppIcon name={getTransactionIcon(transaction)} size={19} weight="medium" color={tile.foreground} />
        </View>

        <View style={styles.details}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {transaction.counterparty}
          </AppText>
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {transaction.note ?? transaction.counterpartyDetail ?? transaction.reference}
          </AppText>
        </View>

        <View style={styles.trailing}>
          <AppText
            variant="bodyStrong"
            numeric
            numberOfLines={1}
            style={[styles.amount, { color: amountColor }]}>
            {formatSignedMoney(
              transaction.amount,
              transaction.currency,
              transaction.direction
            )}
          </AppText>
          <AppText variant="caption" tone="muted" numeric>
            {formatTime(transaction.createdAt)}
          </AppText>
          {transaction.status === 'completed' ? null : (
            <StatusBadge status={transaction.status} style={styles.badge} />
          )}
        </View>
      </Pressable>

      {showDivider ? <Divider inset={ICON_INSET} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 68,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 2,
    maxWidth: '45%',
  },
  amount: {
    textAlign: 'right',
  },
  badge: {
    marginTop: spacing.xs,
  },
});
