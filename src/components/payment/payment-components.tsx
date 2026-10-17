import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppIllustration } from '@/components/ui/AppIllustration';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/button';
import type { IconName } from '@/constants/icons';
import type { PaymentMethod, PaymentRecipient } from '@/data/payment-data';
import { getTzPhoneInputDigits } from '@/lib/phone';
import { useAppTheme } from '@/theme';
import { typography } from '@/theme/typography';
import { formatMoney } from '@/utils/format-money';

export type PaymentState = 'success' | 'failed' | 'pending';

export type DetailRow = {
  label: string;
  value: string;
  muted?: boolean;
};

export function PaymentStatus({
  state,
  label,
}: {
  state: PaymentState;
  label: string;
}) {
  const { colors } = useAppTheme();

  const map: Record<
    PaymentState,
    { background: string; border: string; icon: IconName; iconColor: string; labelColor: string }
  > = {
    success: {
      background: colors.successSoft,
      border: colors.successBorder,
      icon: 'success',
      iconColor: colors.success,
      labelColor: colors.success,
    },
    failed: {
      background: colors.errorSoft,
      border: colors.errorBorder,
      icon: 'failed',
      iconColor: colors.error,
      labelColor: colors.error,
    },
    pending: {
      background: colors.warningSoft,
      border: colors.warningBorder,
      icon: 'pending',
      iconColor: colors.warning,
      labelColor: colors.warning,
    },
  };

  const palette = map[state];

  return (
    <View
      style={[
        styles.stateBadge,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
      ]}>
      <AppIcon name={palette.icon} size={16} color={palette.iconColor} />
      <AppText variant="bodySmallStrong" color={palette.labelColor}>
        {label}
      </AppText>
    </View>
  );
}

export function AmountInput({
  value,
  onChangeText,
  note,
  onNoteChange,
  title,
  subtitle,
}: {
  value: string;
  onChangeText: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  title: string;
  subtitle: string;
}) {
  const { colors, radius, space } = useAppTheme();

  return (
    <View style={styles.amountFieldWrap}>
      <AppText variant="bodySmall" color={colors.textSecondary}>
        {title}
      </AppText>
      <View style={styles.amountInputRow}>
        <AppText variant="bodyStrong" color={colors.textSecondary}>
          TZS
        </AppText>
        <TextInput
          accessibilityLabel={title}
          value={value}
          onChangeText={onChangeText}
          keyboardType="number-pad"
          returnKeyType="done"
          autoFocus
          selectionColor={colors.primary}
          placeholder="0"
          placeholderTextColor={colors.textTertiary}
          style={[styles.amountInput, typography.amountInput, { color: colors.text }]}
        />
      </View>
      <View
        style={[
          styles.noteGroup,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: space.base,
            paddingVertical: space.sm,
          },
        ]}>
        <AppText variant="bodySmall" color={colors.textSecondary}>
          {subtitle}
        </AppText>
        <TextInput
          value={note}
          onChangeText={onNoteChange}
          multiline
          maxLength={120}
          placeholder="Add a short note"
          placeholderTextColor={colors.textTertiary}
          style={[
            styles.noteInput,
            typography.inputSmall,
            {
              color: colors.text,
              lineHeight: 22,
              minHeight: 48,
              width: '100%',
              minWidth: 0,
              textAlignVertical: 'top',
            },
          ]}
        />
      </View>
    </View>
  );
}

export function RecipientSelector({
  value,
  onPhoneChange,
  recipients,
  selectedId,
  onSelect,
  title,
}: {
  value: string;
  onPhoneChange: (value: string) => void;
  recipients: readonly PaymentRecipient[];
  selectedId: string;
  onSelect: (recipient: PaymentRecipient) => void;
  title: string;
}) {
  const { colors, radius, space } = useAppTheme();

  return (
    <View style={styles.stack}>
      <View style={styles.sectionHeaderRow}>
        <AppText variant="bodySmallStrong">{title}</AppText>
      </View>
      <View
        style={[
          styles.inputShell,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: space.base,
          },
        ]}>
        <AppIcon name="phone" size={17} color={colors.textSecondary} />
        <AppText variant="bodySmall" color={colors.textSecondary}>+255</AppText>
        <TextInput
          accessibilityLabel="Phone number, Tanzania country code plus 255"
          value={value}
          onChangeText={(next) => onPhoneChange(getTzPhoneInputDigits(next))}
          placeholder="712 345 678"
          placeholderTextColor={colors.textTertiary}
          keyboardType="phone-pad"
          maxLength={9}
          style={[styles.textInput, typography.input, { minHeight: 48, color: colors.text }]}
        />
      </View>

      <View style={styles.sectionHeaderRow}>
        <AppText variant="bodySmallStrong">Recent recipients</AppText>
      </View>
      <View style={styles.contactList}>
        {recipients.map((recipient) => {
          const isSelected = selectedId === recipient.id;
          return (
            <Pressable
              key={recipient.id}
              onPress={() => onSelect(recipient)}
              style={({ pressed }) => [
                styles.contactRow,
                {
                  backgroundColor: pressed ? colors.surfacePressed : colors.surface,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderWidth: isSelected ? 1.5 : 1,
                  borderRadius: radius.md,
                  padding: space.base,
                },
              ]}>
              <View
                style={[
                  styles.avatar,
                  {
                    backgroundColor: colors.primarySoft,
                  },
                ]}>
                <AppText variant="bodySmallStrong" color={colors.primary}>
                  {recipient.name.slice(0, 1).toUpperCase()}
                </AppText>
              </View>
              <View style={styles.contactCopy}>
                <AppText variant="bodyStrong">{recipient.name}</AppText>
                <AppText variant="bodySmall" color={colors.textSecondary}>
                  {recipient.phone}
                </AppText>
                <AppText variant="bodySmall" color={colors.textTertiary}>
                  Last used: {recipient.lastUsed}
                </AppText>
              </View>
              {isSelected ? (
                <View
                  style={[
                    styles.checkPill,
                    {
                      backgroundColor: colors.primarySoft,
                      borderColor: colors.primary,
                    },
                  ]}>
                  <AppIcon name="check" size={14} color={colors.primary} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function PaymentMethodSelector({
  methods,
  selectedId,
  onSelect,
}: {
  methods: readonly PaymentMethod[];
  selectedId: string;
  onSelect: (method: PaymentMethod) => void;
}) {
  const { colors, radius, space } = useAppTheme();

  return (
    <View style={styles.stack}>
      <AppText variant="bodySmallStrong">Payment method</AppText>
      {methods.map((method) => {
        const isSelected = selectedId === method.id;
        return (
          <Pressable
            key={method.id}
            onPress={() => onSelect(method)}
            style={({ pressed }) => [
              styles.methodCard,
              {
                backgroundColor: pressed ? colors.surfacePressed : colors.surface,
                borderColor: isSelected ? colors.primary : colors.border,
                borderWidth: isSelected ? 1.5 : 1,
                borderRadius: radius.md,
                padding: space.base,
              },
            ]}>
            <View
              style={[
                styles.methodIcon,
                {
                  backgroundColor: colors.primarySoft,
                  borderRadius: radius.md,
                },
              ]}>
              <AppIcon name={method.icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.contactCopy}>
              <AppText variant="bodyStrong">{method.name}</AppText>
              <AppText variant="bodySmall" color={colors.textSecondary}>
                {method.description}
              </AppText>
            </View>
            {isSelected ? (
              <View
                style={[
                  styles.checkPill,
                  {
                    backgroundColor: colors.primarySoft,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <AppIcon name="check" size={14} color={colors.primary} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function PaymentReview({
  title,
  subtitle,
  rows,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  title: string;
  subtitle?: string;
  rows: DetailRow[];
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const { colors, radius, space } = useAppTheme();

  return (
    <View style={styles.stack}>
      <View style={styles.reviewHeader}>
        <View>
          <AppText variant="title2">{title}</AppText>
          {subtitle ? (
            <AppText variant="bodySmall" color={colors.textSecondary}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.reviewCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: space.base,
          },
        ]}>
        {rows.map((row) => (
          <View key={row.label} style={styles.reviewRow}>
            <AppText variant="bodySmall" color={colors.textSecondary}>
              {row.label}
            </AppText>
            <AppText
              variant={row.muted ? 'bodySmallStrong' : 'bodyStrong'}
              color={row.muted ? colors.textSecondary : colors.text}
              align="right"
              numeric
              style={styles.reviewValue}
            >
              {row.value}
            </AppText>
          </View>
        ))}
      </View>

      <View style={styles.ctaRow}>
        <Button label={secondaryLabel} variant="secondary" fullWidth style={styles.ctaButton} onPress={onSecondary} />
        <Button label={primaryLabel} fullWidth style={styles.ctaButton} onPress={onPrimary} />
      </View>
    </View>
  );
}

export function PaymentSuccess({
  amount,
  fee,
  total,
  transactionId,
  recipient,
  reference,
  dateTime,
  onPrimary,
  onSecondary,
}: {
  amount: number;
  fee: number;
  total: number;
  transactionId: string;
  recipient: string;
  reference: string;
  dateTime: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const { colors, radius, space } = useAppTheme();

  return (
    <View style={styles.resultPanel}>
      <AppIllustration name="moneyReceived" width={168} height={112} />
      <View
        style={[
          styles.successIconWrap,
          { backgroundColor: colors.successSoft, borderColor: colors.successBorder },
        ]}
      >
        <AppIcon name="success" size={28} color={colors.success} />
      </View>
      <AppText variant="title1" align="center">
        Payment successful
      </AppText>
      <AppText variant="display" align="center" numeric style={{ marginTop: space.xs }}>
        {formatMoney(amount, 'TZS')}
      </AppText>
      <View
        style={[
          styles.resultSummary,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: space.base,
          },
        ]}
      >
        <DetailCell label="Recipient" value={recipient} />
        <DetailCell label="Fee" value={formatMoney(fee, 'TZS')} />
        <DetailCell label="Total debited" value={formatMoney(total, 'TZS')} />
        <DetailCell label="Reference" value={reference} />
        <DetailCell label="Transaction ID" value={transactionId} />
        <DetailCell label="Date / time" value={dateTime} />
      </View>
      <View style={styles.ctaRow}>
        <Button label="View receipt" variant="secondary" fullWidth style={styles.ctaButton} onPress={onPrimary} />
        <Button label="Done" fullWidth style={styles.ctaButton} onPress={onSecondary} />
      </View>
    </View>
  );
}

export function PaymentFailed({
  amount,
  recipient,
  status = 'failed',
  onPrimary,
  onSecondary,
}: {
  amount: number;
  recipient: string;
  status?: 'failed' | 'cancelled';
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const { colors, radius, space } = useAppTheme();

  return (
    <View style={styles.resultPanel}>
      <View
        style={[
          styles.successIconWrap,
          { backgroundColor: colors.errorSoft, borderColor: colors.errorBorder },
        ]}
      >
        <AppIcon name="failed" size={28} color={colors.error} />
      </View>
      <AppText variant="title1" align="center">
        {status === 'cancelled' ? 'Payment cancelled' : 'Payment not completed'}
      </AppText>
      <AppText variant="display" align="center" numeric style={{ marginTop: space.xs }}>
        {formatMoney(amount, 'TZS')}
      </AppText>
      <View
        style={[
          styles.resultSummary,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: space.base,
          },
        ]}
      >
        <DetailCell label="Recipient" value={recipient} />
        <DetailCell
          label="Status"
          value={status === 'cancelled' ? 'Cancelled or expired' : 'Unable to complete'}
        />
      </View>
      <View style={styles.ctaRow}>
        <Button label="Retry" variant="secondary" fullWidth style={styles.ctaButton} onPress={onPrimary} />
        <Button label="Done" fullWidth style={styles.ctaButton} onPress={onSecondary} />
      </View>
    </View>
  );
}

export function PaymentPending({
  amount,
  recipient,
  reference,
  onPrimary,
  onSecondary,
}: {
  amount: number;
  recipient: string;
  reference: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const { colors, radius, space } = useAppTheme();

  return (
    <View style={styles.resultPanel}>
      <View
        style={[
          styles.successIconWrap,
          { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder },
        ]}
      >
        <AppIcon name="pending" size={28} color={colors.warning} />
      </View>
      <AppText variant="title1" align="center">
        Payment pending
      </AppText>
      <AppText variant="display" align="center" numeric style={{ marginTop: space.xs }}>
        {formatMoney(amount, 'TZS')}
      </AppText>
      <View
        style={[
          styles.resultSummary,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: space.base,
          },
        ]}
      >
        <DetailCell label="Recipient" value={recipient} />
        <DetailCell label="Reference" value={reference} />
        <DetailCell label="Status" value="Waiting for confirmation" />
      </View>
      <View style={styles.ctaRow}>
        <Button label="View details" variant="secondary" fullWidth style={styles.ctaButton} onPress={onPrimary} />
        <Button label="Done" fullWidth style={styles.ctaButton} onPress={onSecondary} />
      </View>
    </View>
  );
}

export function ReceiptDetails({
  kind,
  amount,
  sender,
  recipient,
  dateTime,
  reference,
  paymentMethod,
  fee,
  total,
  onShare,
  onCopy,
}: {
  kind: string;
  amount: number;
  sender: string;
  recipient: string;
  dateTime: string;
  reference: string;
  paymentMethod: string;
  fee: number;
  total: number;
  onShare: () => void;
  onCopy: () => void;
}) {
  const { colors, radius, space } = useAppTheme();

  return (
    <View style={styles.stack}>
      <View style={styles.receiptHeader}>
        <AppIllustration name="receipt" width={144} height={92} />
        <View style={[styles.logoBox, { backgroundColor: colors.primarySoft }]}>
          <AppText variant="bodyStrong" color={colors.primary}>
            LNA
          </AppText>
        </View>
        <AppText variant="title2">Mori Pay</AppText>
      </View>

      <PaymentStatus state="success" label="Successful" />

      <View
        style={[
          styles.receiptCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.lg,
            padding: space.base,
          },
        ]}
      >
        <AppText variant="bodySmall" color={colors.textSecondary}>
          {kind}
        </AppText>
        <AppText variant="display" numeric style={{ marginTop: space.xs }}>
          {formatMoney(amount, 'TZS')}
        </AppText>
        <View style={styles.receiptRows}>
          <DetailCell label="Sender" value={sender} />
          <DetailCell label="Recipient / merchant" value={recipient} />
          <DetailCell label="Date / time" value={dateTime} />
          <DetailCell label="Reference" value={reference} />
          <DetailCell label="Payment method" value={paymentMethod} />
          <DetailCell label="Fee" value={formatMoney(fee, 'TZS')} />
          <DetailCell label="Total" value={formatMoney(total, 'TZS')} />
        </View>
      </View>

      <View style={styles.ctaRow}>
        <Button label="Share" variant="secondary" fullWidth style={styles.ctaButton} onPress={onShare} />
        <Button label="Copy details" fullWidth style={styles.ctaButton} onPress={onCopy} />
      </View>
    </View>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.detailCell}>
      <AppText variant="bodySmall" color={colors.textSecondary}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" align="right" numberOfLines={2} numeric>
        {value}
      </AppText>
    </View>
  );
}

export function FlowHeader({
  title,
  step,
  onBack,
  icon,
}: {
  title: string;
  step: string;
  onBack: () => void;
  icon: IconName;
}) {
  const { colors, radius } = useAppTheme();

  return (
    <View style={styles.headerBar}>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [
          styles.backButton,
          { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border },
        ]}>
        <AppIcon name="chevronLeft" size={18} color={colors.text} />
      </Pressable>
      <View style={styles.headerMeta}>
        <AppText variant="bodySmall" color={colors.textSecondary}>
          {step}
        </AppText>
        <AppText variant="title2">{title}</AppText>
      </View>
      <View
        style={[
          styles.headerIcon,
          {
            backgroundColor: colors.primarySoft,
            borderRadius: radius.circle,
          },
        ]}
      >
        <AppIcon name={icon} size={18} color={colors.primary} weight="semibold" />
      </View>
    </View>
  );
}

export function FlowOverviewCard({
  title,
  description,
  icon,
  onPress,
  featured = false,
}: {
  title: string;
  description: string;
  icon: IconName;
  onPress: () => void;
  featured?: boolean;
}) {
  const { colors, radius, space } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        featured && styles.featuredCard,
        {
          backgroundColor: featured
            ? pressed
              ? colors.primaryPressed
              : colors.primary
            : pressed
              ? colors.surfacePressed
              : colors.surface,
          borderColor: featured ? colors.primary : colors.border,
          borderRadius: radius.lg,
          padding: featured ? space.lg : space.base,
        },
      ]}
    >
      <View
        style={[
          styles.cardIcon,
          featured && styles.featuredCardIcon,
          { backgroundColor: featured ? colors.onPrimary : colors.primarySoft },
        ]}
      >
        <AppIcon name={icon} size={20} color={colors.primary} weight="semibold" />
      </View>
      <View style={styles.cardCopy}>
        <AppText variant={featured ? 'title2' : 'title3'} color={featured ? colors.onPrimary : undefined}>
          {title}
        </AppText>
        <AppText
          variant="bodySmall"
          color={featured ? colors.textInverseSecondary : colors.textSecondary}
        >
          {description}
        </AppText>
      </View>
      <AppIcon
        name="chevronRight"
        size={18}
        color={featured ? colors.onPrimary : colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    gap: 10,
  },
  textInput: { flex: 1 },
  contactList: { gap: 12 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCopy: { flex: 1, gap: 2 },
  checkPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
  },
  methodIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountFieldWrap: { gap: 14 },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  amountInput: {
    flex: 1,
    minWidth: 0,
    width: 0,
    paddingVertical: 0,
    minHeight: 52,
  },
  noteGroup: { borderWidth: 1, gap: 8 },
  noteInput: { paddingVertical: 0 },
  reviewHeader: { gap: 4 },
  reviewCard: { gap: 12 },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 2,
  },
  reviewValue: { flexShrink: 1 },
  ctaRow: { flexDirection: 'row', gap: 12 },
  ctaButton: { flex: 1 },
  resultPanel: { gap: 20, alignItems: 'center' },
  successIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultSummary: { width: '100%', gap: 14 },
  detailCell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  receiptHeader: { alignItems: 'center', gap: 12 },
  logoBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptCard: { width: '100%', gap: 16 },
  receiptRows: { gap: 12 },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMeta: { flex: 1, gap: 2 },
  headerIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
  },
  featuredCard: {
    minHeight: 116,
    borderWidth: 0,
    gap: 16,
  },
  cardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredCardIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
  },
  cardCopy: { flex: 1, gap: 2 },
});
