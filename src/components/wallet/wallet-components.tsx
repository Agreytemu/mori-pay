import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import type { IconName } from '@/constants/icons';
import type { WalletAccountData, WalletAccountStatus, WalletActivity } from '@/data/wallet-account';
import { useAppTheme } from '@/theme';
import { formatMoney } from '@/utils/format-money';

const CARD_INK = '#F3FAF7';
const CARD_LABEL = 'rgba(214, 236, 230, 0.62)';
const CARD_MUTED = '#C4E4DB';
const CARD_GREEN = '#5BC4A8';
const CARD_ACCENT = '#7FC9B9';

export function AccountStatus({ status }: { status: WalletAccountStatus }) {
  const { colors } = useAppTheme();
  const settings = {
    active: { label: 'Active', color: colors.success, background: colors.successSoft, icon: 'success' as const },
    pending: { label: 'Pending', color: colors.warning, background: colors.warningSoft, icon: 'pending' as const },
    limited: { label: 'Limited', color: colors.error, background: colors.errorSoft, icon: 'warning' as const },
  }[status];

  return (
    <View style={[styles.status, { backgroundColor: settings.background }]}>
      <AppIcon name={settings.icon} size={14} color={settings.color} />
      <AppText variant="caption" color={settings.color}>
        {settings.label}
      </AppText>
    </View>
  );
}

export function BalanceDisplay({
  account,
  visible,
  size = 'large',
}: {
  account: WalletAccountData;
  visible: boolean;
  size?: 'large' | 'compact';
}) {
  const { colors } = useAppTheme();
  const amount = visible
    ? formatMoney(account.availableBalance, account.currency).replace('TSh ', '')
    : '••••••';

  if (size === 'compact') {
    return (
      <View style={styles.balanceCopy}>
        <AppText variant="bodySmall" color={colors.textSecondary}>
          Available balance
        </AppText>
        <View style={styles.balanceValueRow}>
          <AppText variant="bodySmallStrong" color={colors.text}>
            {account.currency}
          </AppText>
          <AppText variant="amount" color={colors.text} numberOfLines={1}>
            {amount}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.balanceCopy}>
      <AppText variant="cardLabel" color={CARD_LABEL}>
        AVAILABLE BALANCE
      </AppText>
      <View style={styles.balanceValueRow}>
        <AppText variant="title2" color={CARD_INK}>
          {account.currency}
        </AppText>
        <AppText
          variant="display"
          color={CARD_INK}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={styles.balanceAmount}>
          {amount}
        </AppText>
      </View>
    </View>
  );
}

function ContourPattern() {
  return (
    <>
      <View pointerEvents="none" style={[styles.ring, styles.ringA1]} />
      <View pointerEvents="none" style={[styles.ring, styles.ringA2]} />
      <View pointerEvents="none" style={[styles.ring, styles.ringA3]} />
      <View pointerEvents="none" style={[styles.ring, styles.ringA4]} />
      <View pointerEvents="none" style={[styles.ring, styles.ringA5]} />
      <View pointerEvents="none" style={[styles.ring, styles.ringB1]} />
      <View pointerEvents="none" style={[styles.ring, styles.ringB2]} />
      <View pointerEvents="none" style={[styles.ring, styles.ringB3]} />
      <View pointerEvents="none" style={[styles.ring, styles.ringB4]} />
      <View pointerEvents="none" style={[styles.sweep, styles.sweepOne]} />
      <View pointerEvents="none" style={[styles.sweep, styles.sweepTwo]} />
    </>
  );
}

function VerticalBrand({ label }: { label: string }) {
  return (
    <View pointerEvents="none" style={styles.verticalWrap}>
      <AppText style={styles.verticalBrand} numberOfLines={1}>
        {label.toUpperCase()}
      </AppText>
    </View>
  );
}

export function AccountCard({
  account,
  visible,
  onToggleVisibility,
  onPress,
}: {
  account: WalletAccountData;
  visible: boolean;
  onToggleVisibility: () => void;
  onPress: () => void;
}) {
  const { radius, space } = useAppTheme();
  const locked = account.status === 'limited';
  const brandWords = account.brand.trim().split(/\s+/);
  const brandTop = (brandWords[0] ?? account.brand).toUpperCase();
  const brandRest = brandWords.slice(1).join(' ').toUpperCase();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${account.accountType}. Available balance ${
        visible ? formatMoney(account.availableBalance, account.currency) : 'hidden'
      }`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderRadius: radius.xl, padding: space.base },
        pressed && styles.cardPressed,
      ]}>
      <ContourPattern />
      <VerticalBrand label={account.brand} />

      <View pointerEvents="none" style={styles.content}>
        <View style={styles.brandRow}>
          <View style={styles.brandStack}>
            <AppText variant="title1" style={styles.brandLine} numberOfLines={1}>
              {brandTop}
            </AppText>
            {brandRest ? (
              <AppText
                variant="title1"
                style={[styles.brandLine, styles.brandLineAccent]}
                numberOfLines={1}>
                {brandRest}
              </AppText>
            ) : null}
          </View>
          <AccountStatus status={account.status} />
        </View>

        <View style={styles.balanceRow}>
          <BalanceDisplay account={account} visible={visible} />
        </View>

        <View style={styles.footerRow}>
          <AppText style={styles.maskedNumber} numberOfLines={1}>
            {maskIdentifier(account.accountNumber)}
          </AppText>
          <View style={styles.footerRight}>
            <AppText variant="cardLabel" color={CARD_ACCENT} numberOfLines={1}>
              {account.accountType.toUpperCase()}
            </AppText>
            <AppIcon name="chevronRight" size={14} color={CARD_GREEN} weight="semibold" />
          </View>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide balance' : 'Show balance'}
        hitSlop={10}
        onPress={onToggleVisibility}
        style={({ pressed }) => [
          styles.visibilityButton,
          { backgroundColor: pressed ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.07)' },
        ]}>
        <AppIcon name={visible ? 'eyeOff' : 'eye'} size={18} color={CARD_INK} />
      </Pressable>

      {locked ? (
        <View pointerEvents="none" style={styles.lockedOverlay}>
          <AppIcon name="pin" size={22} color="#E0A94B" />
          <AppText variant="bodySmallStrong" color="#E0A94B">
            ACCOUNT LOCKED
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

export function AccountInfoRow({
  label,
  value,
  icon,
  onPress,
  last = false,
}: {
  label: string;
  value: string;
  icon?: IconName;
  onPress?: () => void;
  /** Drops the bottom hairline on the final row of a group. */
  last?: boolean;
}) {
  const { colors } = useAppTheme();
  const contents = (
    <>
      <View style={styles.infoLabel}>
        {icon ? <AppIcon name={icon} size={17} color={colors.textSecondary} /> : null}
        <AppText variant="bodySmall" color={colors.textSecondary}>
          {label}
        </AppText>
      </View>
      <View style={styles.infoValue}>
        <AppText variant="bodySmallStrong" align="right">
          {value}
        </AppText>
        {onPress ? <AppIcon name="copy" size={16} color={colors.textTertiary} /> : null}
      </View>
    </>
  );

  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
      onPress={onPress}
      style={({ pressed }) => [styles.infoRow, pressed && { opacity: 0.65 }]}>
      {contents}
    </Pressable>
  ) : (
    <View
      style={[
        styles.infoRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
      ]}>{contents}</View>
  );
}

export function WalletAction({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
}) {
  const { colors, radius } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.walletAction, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.walletActionIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
        <AppIcon name={icon} size={19} color={colors.primary} weight="semibold" />
      </View>
      <AppText variant="caption" align="center" numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function WalletActivityItem({ item }: { item: WalletActivity }) {
  const { colors, radius } = useAppTheme();
  const credit = item.direction === 'credit';

  return (
    <View style={styles.activityRow}>
      <View style={[styles.activityIcon, { backgroundColor: colors.surfaceMuted, borderRadius: radius.circle }]}>
        <AppIcon name={item.icon} size={17} color={colors.textSecondary} />
      </View>
      <View style={styles.activityText}>
        <AppText variant="bodySmallStrong" numberOfLines={1}>
          {item.description}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {item.date} · {item.status}
        </AppText>
      </View>
      <AppText variant="bodySmallStrong" color={credit ? colors.success : colors.text}>
        {credit ? '+' : '−'}{formatMoney(item.amount, 'TZS')}
      </AppText>
    </View>
  );
}

function maskIdentifier(accountNumber: string): string {
  const lastFour = accountNumber.replace(/\D/g, '').slice(-4);
  return `••••  ••••  ${lastFour}`;
}

const GREEN = '91, 196, 168';

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    minHeight: 198,
    borderWidth: 1,
    borderColor: `rgba(${GREEN}, 0.20)`,
    backgroundColor: '#0A0F0D',
    overflow: 'hidden',
    shadowColor: '#04120E',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.30,
    shadowRadius: 18,
    elevation: 7,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 16,
    paddingLeft: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  brandStack: {
    gap: 0,
  },
  brandLine: {
    color: CARD_INK,
    letterSpacing: 2.5,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  brandLineAccent: {
    color: CARD_GREEN,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    paddingRight: 44,
  },
  balanceCopy: {
    flex: 1,
    gap: 6,
  },
  balanceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    flexShrink: 1,
  },
  balanceAmount: {
    flexShrink: 1,
    letterSpacing: -0.7,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderTopColor: 'rgba(255,255,255,0.12)',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  maskedNumber: {
    fontFamily: 'monospace',
    fontSize: 14,
    letterSpacing: 1.5,
    color: CARD_MUTED,
  },
  visibilityButton: {
    position: 'absolute',
    zIndex: 4,
    right: 16,
    top: '50%',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  lockedOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: 5,
    backgroundColor: 'rgba(6, 10, 9, 0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  verticalWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  verticalBrand: {
    width: 176,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 6,
    color: `rgba(${GREEN}, 0.30)`,
    textTransform: 'uppercase',
    transform: [{ rotate: '-90deg' }],
  },
  ring: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 9999,
  },
  ringA1: { width: 340, height: 340, right: -130, top: -210, borderColor: `rgba(${GREEN}, 0.09)` },
  ringA2: { width: 270, height: 270, right: -95, top: -175, borderColor: `rgba(${GREEN}, 0.11)` },
  ringA3: { width: 210, height: 210, right: -65, top: -145, borderColor: `rgba(${GREEN}, 0.13)` },
  ringA4: { width: 150, height: 150, right: -35, top: -115, borderColor: `rgba(${GREEN}, 0.14)` },
  ringA5: { width: 100, height: 100, right: -10, top: -90, borderColor: `rgba(${GREEN}, 0.16)` },
  ringB1: { width: 280, height: 280, left: -180, bottom: -180, borderColor: `rgba(${GREEN}, 0.08)` },
  ringB2: { width: 210, height: 210, left: -145, bottom: -145, borderColor: `rgba(${GREEN}, 0.10)` },
  ringB3: { width: 150, height: 150, left: -115, bottom: -115, borderColor: `rgba(${GREEN}, 0.11)` },
  ringB4: { width: 100, height: 100, left: -90, bottom: -90, borderColor: `rgba(${GREEN}, 0.13)` },
  sweep: {
    position: 'absolute',
    borderWidth: 1,
  },
  sweepOne: {
    width: 420,
    height: 240,
    borderRadius: 120,
    right: -170,
    top: 24,
    borderColor: `rgba(${GREEN}, 0.08)`,
    transform: [{ rotate: '-16deg' }],
  },
  sweepTwo: {
    width: 380,
    height: 180,
    borderRadius: 90,
    left: -150,
    top: 96,
    borderColor: `rgba(${GREEN}, 0.07)`,
    transform: [{ rotate: '13deg' }],
  },
  infoRow: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  walletAction: {
    flex: 1,
    minWidth: 60,
    alignItems: 'center',
    gap: 7,
    paddingVertical: 4,
  },
  walletActionIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activityIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {
    flex: 1,
    gap: 2,
  },
});
