import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/theme';
import { formatAmount, progressRatio } from '@/utils/format';

/** Chip label in the balance card's top-right corner. */
const LAYOUT_BADGE = 'Wallet';

export type BalanceCardProps = {
  /** Account holder name, shown as the card heading. */
  accountName: string;
  /** Masked wallet / account identifier. */
  accountNumber: string;
  availableBalance: number;
  currency?: string;
  pendingAmount?: number;
  /** Hides all amounts on the card while keeping the wallet context visible. */
  balanceVisible?: boolean;
  /** Daily transfer ceiling and how much of it is still available. */
  dailyLimit?: number;
  dailyLimitRemaining?: number;
  onPress?: () => void;
};

/**
 * Primary account summary. Solid brand surface (no gradient) with inverted
 * text so it reads as the wallet, and a subtle limit meter underneath.
 */
export function BalanceCard({
  accountName,
  accountNumber,
  availableBalance,
  currency = 'TZS',
  pendingAmount = 0,
  balanceVisible = true,
  dailyLimit,
  dailyLimitRemaining,
  onPress,
}: BalanceCardProps) {
  const { colors, space, radius, layout } = useAppTheme();

  const used = dailyLimit && dailyLimitRemaining ? dailyLimit - dailyLimitRemaining : undefined;
  const ratio = used !== undefined && dailyLimit ? progressRatio(used, dailyLimit) : 0;
  const balanceLabel = balanceVisible
    ? formatAmount(availableBalance, currency)
    : `${currency} ••••••`;

  const body = (
    <>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <AppText variant="cardLabel" color={colors.textInverseSecondary}>
            Available balance
          </AppText>
          <AppText
            variant="amountHero"
            color={colors.textInverse}
            numberOfLines={1}
            minimumFontScale={0.7}
            adjustsFontSizeToFit>
            {balanceLabel}
          </AppText>
        </View>
        <View style={styles.brandMark}>
          <AppText variant="overline" color={colors.textInverse}>
            {LAYOUT_BADGE}
          </AppText>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: colors.onPrimary }]} />

      <View style={styles.bottomRow}>
        <View style={styles.metaBlock}>
          <AppText variant="cardLabel" color={colors.textInverseSecondary}>
            Account
          </AppText>
          <AppText variant="bodySmallStrong" color={colors.textInverse} numberOfLines={1}>
            {accountName}
          </AppText>
          <AppText variant="bodySmall" color={colors.textInverseSecondary} numberOfLines={1}>
            {accountNumber}
          </AppText>
        </View>

        {pendingAmount > 0 ? (
          <View style={styles.pendingBlock}>
            <AppText variant="cardLabel" color={colors.textInverseSecondary} align="right">
              Pending
            </AppText>
            <AppText variant="bodySmallStrong" color={colors.textInverse} align="right">
              {balanceVisible ? formatAmount(pendingAmount, currency) : `${currency} ••••••`}
            </AppText>
          </View>
        ) : null}
      </View>

      {balanceVisible && used !== undefined && dailyLimit ? (
        <View style={styles.meterBlock}>
          <View style={styles.meterLabels}>
            <AppText variant="cardLabel" color={colors.textInverseSecondary}>
              Daily limit used
            </AppText>
            <AppText variant="cardLabel" color={colors.textInverse}>
              {formatAmount(used, currency)} / {formatAmount(dailyLimit, currency)}
            </AppText>
          </View>
          <View style={[styles.meterTrack, { backgroundColor: colors.onPrimary }]}>
            <View
              style={[
                styles.meterFill,
                { width: `${ratio}%`, backgroundColor: colors.textInverse },
              ]}
            />
          </View>
        </View>
      ) : null}
    </>
  );

  const surfaceStyle = {
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingHorizontal: space.base,
    paddingTop: space.base,
    paddingBottom: space.base,
    gap: space.md,
    minHeight: layout.balanceCardMinHeight,
  };

  if (!onPress) {
    return (
      <View style={[styles.card, surfaceStyle]} accessibilityRole="summary">
        {body}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Account ${accountName}. Available balance ${
        balanceVisible ? balanceLabel : 'hidden'
      }`}
      style={({ pressed }) => [styles.card, surfaceStyle, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.9,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  identity: {
    flex: 1,
    gap: 4,
  },
  brandMark: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  divider: {
    height: 1,
    opacity: 0.18,
    width: '100%',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaBlock: {
    flex: 1,
    gap: 2,
  },
  pendingBlock: {
    alignItems: 'flex-end',
    gap: 2,
  },
  meterBlock: {
    gap: 6,
  },
  meterLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meterTrack: {
    height: 4,
    borderRadius: 999,
    opacity: 0.9,
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 999,
  },
});