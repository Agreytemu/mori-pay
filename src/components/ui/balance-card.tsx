import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { radius, spacing, useAppTheme } from '@/theme';
import { formatMoney } from '@/utils/format-money';

export type BalanceCardProps = {
  label?: string;
  amountMinor: number;
  currency: string;
  /** Masked wallet or account reference shown in the footer. */
  accountLabel?: string;
  /** Secondary figure, e.g. money already on its way in. */
  pendingMinor?: number;
  pendingLabel?: string;
  onPressAccount?: () => void;
};

/**
 * Hero card on the home screen showing the available balance.
 *
 * The balance can be hidden — a purely local display preference for now.
 */
export function BalanceCard({
  label = 'Available balance',
  amountMinor,
  currency,
  accountLabel,
  pendingMinor,
  pendingLabel = 'On the way in',
  onPressAccount,
}: BalanceCardProps) {
  const { colors } = useAppTheme();
  const [hidden, setHidden] = useState(false);

  const hasPending = typeof pendingMinor === 'number' && pendingMinor > 0;
  const formattedPending = hasPending ? formatMoney(pendingMinor as number, currency) : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.primary }]}>
      <View style={styles.headerRow}>
        <AppText variant="overline" style={{ color: colors.textInverseSecondary }}>
          {label}
        </AppText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}
          accessibilityState={{ selected: hidden }}
          hitSlop={spacing.sm}
          onPress={() => setHidden((value) => !value)}
          style={({ pressed }) => [styles.eyeButton, pressed && styles.pressed]}>
          <AppIcon
            name={hidden ? 'eyeOff' : 'eye'}
            size={18}
            color={colors.textInverseSecondary}
          />
        </Pressable>
      </View>

      <AppText
        variant="display"
        numeric
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.amount, { color: colors.onPrimary }]}>
        {hidden ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : formatMoney(amountMinor, currency)}
      </AppText>

      <View style={[styles.divider, { backgroundColor: colors.textInverseSecondary }]} />

      <View style={styles.footerRow}>
        {accountLabel ? (
          <Pressable
            accessibilityRole="button"
            disabled={!onPressAccount}
            onPress={onPressAccount}
            style={({ pressed }) => [styles.accountRow, pressed && styles.pressed]}>
            <AppIcon name="wallet" size={15} color={colors.textInverseSecondary} />
            <AppText variant="caption" numeric style={{ color: colors.textInverseSecondary }}>
              {accountLabel}
            </AppText>
            {onPressAccount ? (
              <AppIcon name="chevronRight" size={13} color={colors.textInverseSecondary} />
            ) : null}
          </Pressable>
        ) : (
          <View />
        )}

        {formattedPending ? (
          <View style={styles.pendingRow}>
            <AppIcon name="pending" size={13} color={colors.textInverseSecondary} />
            <AppText variant="caption" tone="inverse" style={{ color: colors.textInverseSecondary }}>
              {pendingLabel}
            </AppText>
            <AppText variant="caption" numeric style={{ color: colors.onPrimary }}>
              {formattedPending}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyeButton: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  amount: {
    marginTop: -spacing.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 24,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
