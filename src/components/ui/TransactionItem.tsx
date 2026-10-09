import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { IconName } from '@/constants/icons';
import { TRANSACTION_STATUS_LABEL, type Transaction, type TransactionStatus } from '@/types';
import { useAppTheme, type StateTone } from '@/theme';
import { formatAmount, formatDateTime, formatTime } from '@/utils/format';

const STATUS_TONE: Record<TransactionStatus, StateTone> = {
  completed: 'success',
  pending: 'warning',
  failed: 'error',
};

const STATUS_ICON = {
  completed: 'success',
  pending: 'pending',
  failed: 'failed',
} as const;

const TYPE_ICON: Record<Transaction['type'], IconName> = {
  send: 'send',
  receive: 'receive',
  payment: 'pay',
  request: 'request',
  deposit: 'receive',
  withdrawal: 'send',
};

export type TransactionItemProps = {
  transaction: Transaction;
  /** Overrides the counterparty heading, used when a note describes the activity. */
  title?: string;
  onPress?: () => void;
  /** Hides the status pill on dense lists where status is implied. */
  showStatus?: boolean;
  /** Renders as the last row of a list without a bottom divider. */
  isLast?: boolean;
};

/**
 * A single ledger row: type glyph, counterparty, reference time, signed amount
 * and status. Shared by Home ("recent") and the full Transactions list.
 */
export function TransactionItem({
  transaction,
  title,
  onPress,
  showStatus = true,
  isLast = false,
}: TransactionItemProps) {
  const { colors, space, radius, layout } = useAppTheme();
  const tone = STATUS_TONE[transaction.status];
  const isCredit = transaction.direction === 'credit';
  const isFailed = transaction.status === 'failed';

  const amountPrefix = isCredit ? '+' : '−';
  const amountColor = isFailed ? colors.textTertiary : isCredit ? colors.success : colors.text;
  const subtitleParts = title
    ? [transaction.counterparty, formatDateTime(transaction.createdAt)]
    : [transaction.counterpartyDetail, transaction.note, formatTime(transaction.createdAt)].filter(
        Boolean
      );

  const body = (
    <>
      <View
        style={[
          styles.iconTile,
          {
            backgroundColor: isCredit ? colors.successSoft : colors.primarySoft,
            borderRadius: radius.md,
          },
        ]}>
        <AppIcon
          name={TYPE_ICON[transaction.type]}
          size={19}
          color={isCredit ? colors.success : colors.primary}
          weight="semibold"
        />
      </View>

      <View style={styles.details}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title ?? transaction.counterparty}
        </AppText>
        <View style={styles.metaRow}>
          <AppText variant="bodySmall" color={colors.textTertiary} numberOfLines={1} style={styles.metaText}>
            {subtitleParts.join(' · ')}
          </AppText>
        </View>
      </View>

      <View style={styles.trailing}>
        <AppText
          variant="amount"
          color={amountColor}
          numberOfLines={1}
          style={isFailed ? styles.failedAmount : undefined}>
          {amountPrefix}
          {formatAmount(transaction.amount, transaction.currency)}
        </AppText>
        {showStatus ? (
          <StatusBadge
            label={TRANSACTION_STATUS_LABEL[transaction.status]}
            tone={tone}
            icon={STATUS_ICON[transaction.status]}
            size="sm"
          />
        ) : null}
      </View>
    </>
  );

  const rowStyle = [
    styles.row,
    {
      gap: space.md,
      paddingVertical: space.md,
      minHeight: layout.listRowMinHeight,
      borderBottomColor: colors.divider,
      borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
    },
  ];

  if (!onPress) {
    return <View style={rowStyle}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title ?? transaction.counterparty}, ${transaction.counterparty}, ${amountPrefix}${formatAmount(
        transaction.amount,
        transaction.currency
      )}, ${TRANSACTION_STATUS_LABEL[transaction.status]}`}
      style={({ pressed }) => [
        rowStyle,
        pressed && { backgroundColor: colors.surfacePressed },
      ]}>
      {body}
    </Pressable>
  );
}

/** Wraps a list of rows in one bordered surface with hairline dividers. */
export function TransactionGroup({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  const { colors, radius } = useAppTheme();

  return (
    <View
      style={[
        styles.group,
        { backgroundColor: colors.surface, borderRadius: radius.lg, borderColor: colors.border },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  group: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconTile: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    flexShrink: 1,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 4,
    maxWidth: '46%',
  },
  failedAmount: {
    textDecorationLine: 'line-through',
  },
});