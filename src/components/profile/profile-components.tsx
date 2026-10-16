import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { AppDialog } from '@/components/ui/app-dialog';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppIllustration } from '@/components/ui/AppIllustration';
import { AppText } from '@/components/ui/AppText';
import { DigitBoxesInput } from '@/components/ui/DigitBoxesInput';
import type { IconName } from '@/constants/icons';
import type {
  ProfileStatus as ProfileStatusValue,
  SecurityActivity,
  SecurityStatus as SecurityStatusValue,
  TrustedDevice,
  UserProfile,
} from '@/data/profile';
import { radius, spacing, useAppTheme } from '@/theme';
import { typography } from '@/theme/typography';
import { formatRelativeTime, maskPhone } from '@/utils/format';

/* ------------------------------------------------------------------ status */

const STATUS_PRESENTATION: Record<
  ProfileStatusValue,
  { label: string; icon: IconName; tone: 'success' | 'info' | 'error' }
> = {
  verified: { label: 'Verified account', icon: 'success', tone: 'success' },
  standard: { label: 'Standard account', icon: 'wallet', tone: 'info' },
  restricted: { label: 'Account restricted', icon: 'warning', tone: 'error' },
};

/** Compact account-status pill used in the header and detail screens. */
export function ProfileStatus({ status }: { status: ProfileStatusValue }) {
  const { colors } = useAppTheme();
  const presentation = STATUS_PRESENTATION[status];
  const tone = {
    success: { fg: colors.success, bg: colors.successSoft },
    info: { fg: colors.textSecondary, bg: colors.surfaceMuted },
    error: { fg: colors.error, bg: colors.errorSoft },
  }[presentation.tone];

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={presentation.label}
      style={[styles.statusPill, { backgroundColor: tone.bg, borderRadius: radius.pill }]}>
      <AppIcon name={presentation.icon} size={13} color={tone.fg} weight="semibold" />
      <AppText variant="caption" color={tone.fg}>
        {presentation.label}
      </AppText>
    </View>
  );
}

/* ------------------------------------------------------------------ header */

export function ProfileHeader({ profile }: { profile: UserProfile }) {
  const { colors, radius, isCompact } = useAppTheme();

  return (
    <View
      style={[
        styles.headerCard,
        {
          borderRadius: radius.xl,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}>
      <Avatar name={profile.fullName} size={58} />
      <View style={styles.headerCopy}>
        <AppText variant="title3" numberOfLines={1}>
          {profile.fullName}
        </AppText>
        <AppText variant="bodySmall" color={colors.textSecondary}>
          {profile.phone ? maskPhone(profile.phone) : 'Phone number not added'}
        </AppText>
        <View style={styles.headerMeta}>
          <ProfileStatus status={profile.status} />
          <AppText variant="caption" color={colors.textTertiary}>
            {profile.memberId}
          </AppText>
        </View>
      </View>
      <AppIllustration
        name="profileData"
        width={isCompact ? 52 : 68}
        height={isCompact ? 50 : 64}
      />
    </View>
  );
}

/* ---------------------------------------------------------------- section */

export function ProfileSection({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { colors, radius } = useAppTheme();

  return (
    <View style={styles.section}>
      {title ? (
        <View style={styles.sectionHeading}>
          <AppText variant="overline" color={colors.textTertiary}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" color={colors.textTertiary}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View
        style={[
          styles.sectionCard,
          { borderRadius: radius.lg, backgroundColor: colors.surface, borderColor: colors.border },
        ]}>
        {children}
      </View>
    </View>
  );
}

/* --------------------------------------------------------------- menu rows */

export type ProfileMenuItemProps = {
  icon?: IconName;
  /** Overrides the icon tile colour, e.g. to tint an activity feed row. */
  iconColor?: string;
  label: string;
  description?: string;
  /** Right-aligned secondary value, e.g. `English`. */
  value?: string;
  onPress?: () => void;
  /** Replaces the chevron, e.g. a `Switch` or a check mark. */
  accessory?: ReactNode;
  showDivider?: boolean;
  tone?: 'default' | 'destructive';
  disabled?: boolean;
  testID?: string;
};

/** One tappable row inside a `ProfileSection`. */
export function ProfileMenuItem({
  icon,
  iconColor,
  label,
  description,
  value,
  onPress,
  accessory,
  showDivider = false,
  tone = 'default',
  disabled = false,
  testID,
}: ProfileMenuItemProps) {
  const { colors, radius } = useAppTheme();
  const destructive = tone === 'destructive';
  const iconColorResolved =
    iconColor ?? (disabled ? colors.textTertiary : destructive ? colors.error : colors.textSecondary);

  const body = (
    <>
      {icon ? (
        <View style={[styles.rowIcon, { borderRadius: radius.sm, backgroundColor: colors.surfaceMuted }]}>
          <AppIcon name={icon} size={17} color={iconColorResolved} weight="medium" />
        </View>
      ) : null}

      <View style={styles.rowCopy}>
        <AppText
          variant="bodyStrong"
          numberOfLines={1}
          style={{ color: disabled ? colors.textTertiary : destructive ? colors.error : colors.text }}>
          {label}
        </AppText>
        {description ? (
          <AppText variant="caption" color={colors.textSecondary} numberOfLines={2}>
            {description}
          </AppText>
        ) : null}
      </View>

      {value ? (
        <AppText variant="caption" color={colors.textSecondary} numberOfLines={1} style={styles.rowValue}>
          {value}
        </AppText>
      ) : null}

      {accessory}

      {!accessory && onPress ? (
        <AppIcon name="chevronRight" size={16} color={colors.textTertiary} weight="medium" />
      ) : null}
    </>
  );

  const row = (
    <View
      style={[
        styles.row,
        showDivider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        disabled && styles.rowDisabled,
      ]}>
      {body}
    </View>
  );

  if (!onPress || disabled) {
    return (
      <View testID={testID} accessibilityLabel={label}>
        {row}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [pressed && { backgroundColor: colors.surfacePressed }]}>
      {row}
    </Pressable>
  );
}

/** Row with a trailing switch. Built on `ProfileMenuItem` so metrics match. */
export function SettingsToggle({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  showDivider = false,
  testID,
}: {
  icon?: IconName;
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
  showDivider?: boolean;
  testID?: string;
}) {
  const { colors } = useAppTheme();

  return (
    <ProfileMenuItem
      testID={testID}
      icon={icon}
      label={label}
      description={description}
      disabled={disabled}
      showDivider={showDivider}
      accessory={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          accessibilityLabel={label}
          trackColor={{ false: colors.backgroundSunken, true: colors.primary }}
          thumbColor={colors.surface}
        />
      }
    />
  );
}

/* ---------------------------------------------------------------- security */

const ACTIVITY_TONES = {
  success: { fg: 'success', bg: 'successSoft' },
  warning: { fg: 'warning', bg: 'warningSoft' },
  info: { fg: 'info', bg: 'infoSoft' },
} as const;

/** Hero card summarising how protected the account currently is. */
export function SecurityStatus({
  status,
  protections,
  lastCheckedAt,
}: {
  status: SecurityStatusValue;
  protections: string[];
  lastCheckedAt: string;
}) {
  const { colors, radius } = useAppTheme();
  const protectedAccount = status === 'protected';
  const foreground = protectedAccount ? colors.success : colors.warning;
  const background = protectedAccount ? colors.successSoft : colors.warningSoft;

  return (
    <View
      style={[
        styles.securityCard,
        {
          borderRadius: radius.xl,
          backgroundColor: colors.surface,
          borderColor: protectedAccount ? colors.successBorder : colors.warningBorder,
        },
      ]}>
      <View style={[styles.securityIcon, { borderRadius: radius.md, backgroundColor: background }]}>
        <AppIcon name="security" size={24} color={foreground} weight="semibold" />
      </View>

      <View style={styles.securityCopy}>
        <AppText variant="cardLabel" color={colors.textSecondary}>
          ACCOUNT SECURITY
        </AppText>
        <AppText variant="title3">
          {protectedAccount ? 'Your account is protected' : 'Review your account security'}
        </AppText>
        <AppText variant="bodySmall" color={colors.textSecondary}>
          {protections.join(' · ') || 'No protections enabled yet'}
        </AppText>
        <AppText variant="caption" color={colors.textTertiary}>
          Last checked {formatRelativeTime(lastCheckedAt)}
        </AppText>
      </View>
    </View>
  );
}

/** Compact row in the security-activity feed. */
export function SecurityActivityRow({
  activity,
  showDivider = false,
}: {
  activity: SecurityActivity;
  showDivider?: boolean;
}) {
  const { colors, radius } = useAppTheme();
  const tone = ACTIVITY_TONES[activity.tone];
  const foreground = colors[tone.fg];

  return (
    <ProfileMenuItem
      icon={activity.icon}
      iconColor={foreground}
      label={activity.title}
      description={`${activity.detail} · ${formatRelativeTime(activity.at)}`}
      accessory={
        <View style={[styles.activityDot, { backgroundColor: foreground, borderRadius: radius.circle }]} />
      }
      showDivider={showDivider}
    />
  );
}

/* ----------------------------------------------------------------- devices */

const PLATFORM_LABEL: Record<TrustedDevice['platform'], string> = {
  android: 'Android',
  ios: 'iOS',
  web: 'Web browser',
};

/** Trusted device tile with a remove action and current-session marker. */
export function DeviceCard({ device, onRemove }: { device: TrustedDevice; onRemove: () => void }) {
  const { colors, radius } = useAppTheme();

  return (
    <View
      style={[
        styles.deviceCard,
        {
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderColor: device.isCurrent ? colors.primary : colors.border,
        },
      ]}>
      <View style={[styles.deviceIcon, { borderRadius: radius.md, backgroundColor: colors.surfaceMuted }]}>
        <AppIcon name={device.platform === 'web' ? 'devices' : 'phone'} size={20} color={colors.textSecondary} weight="medium" />
      </View>

      <View style={styles.deviceCopy}>
        <View style={styles.deviceTitleRow}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.deviceName}>
            {device.name}
          </AppText>
          {device.isCurrent ? (
            <View style={[styles.currentBadge, { borderRadius: radius.pill, backgroundColor: colors.primarySoft }]}>
              <AppText variant="caption" color={colors.primary}>
                This device
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
          {PLATFORM_LABEL[device.platform]} · {device.location}
        </AppText>
        <AppText variant="caption" color={colors.textTertiary}>
          {device.isCurrent ? 'Active now' : `Last active ${formatRelativeTime(device.lastActiveAt)}`}
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          device.isCurrent ? `${device.name} is this device` : `Remove ${device.name}`
        }
        accessibilityState={{ disabled: device.isCurrent }}
        disabled={device.isCurrent}
        hitSlop={8}
        onPress={onRemove}
        style={({ pressed }) => [
          styles.deviceRemove,
          { borderRadius: radius.md, backgroundColor: pressed ? colors.errorSoft : colors.surfaceMuted },
        ]}>
        <AppIcon name="trash" size={17} color={device.isCurrent ? colors.textTertiary : colors.error} weight="medium" />
      </Pressable>
    </View>
  );
}

/* ------------------------------------------------------------------ forms */

export function ProfileField({
  label,
  error,
  hint,
  digitBoxes = false,
  floatingLabel = true,
  leadingContent,
  containerStyle,
  style: inputStyle,
  value,
  placeholder,
  onFocus,
  onBlur,
  ...inputProps
}: {
  label: string;
  error?: string;
  hint?: string;
  digitBoxes?: boolean;
  floatingLabel?: boolean;
  leadingContent?: ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
} & ComponentProps<typeof TextInput>) {
  const { colors, radius } = useAppTheme();
  const flattenedInputStyle = StyleSheet.flatten(inputStyle);
  const [focused, setFocused] = useState(false);
  const hasValue = typeof value === 'string' && value.length > 0;
  const labelFloated = focused || hasValue;
  const [labelProgress] = useState(() => new Animated.Value(labelFloated ? 1 : 0));

  useEffect(() => {
    const animation = Animated.timing(labelProgress, {
      toValue: labelFloated ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [labelFloated, labelProgress]);

  const handleFocus: ComponentProps<typeof TextInput>['onFocus'] = (event) => {
    setFocused(true);
    onFocus?.(event);
  };
  const handleBlur: ComponentProps<typeof TextInput>['onBlur'] = (event) => {
    setFocused(false);
    onBlur?.(event);
  };

  return (
    <View style={[styles.field, containerStyle]}>
      {!floatingLabel ? <AppText variant="bodySmallStrong">{label}</AppText> : null}
      {floatingLabel ? (
        <View
          style={[
            styles.floatingInputCard,
            {
              minHeight: flattenedInputStyle?.minHeight ?? (digitBoxes ? 64 : 58),
              borderRadius: flattenedInputStyle?.borderRadius ?? radius.md,
              backgroundColor: flattenedInputStyle?.backgroundColor ?? colors.surface,
              borderColor: error
                ? colors.error
                : focused
                  ? colors.primary
                  : flattenedInputStyle?.borderColor ?? colors.border,
              borderWidth: flattenedInputStyle?.borderWidth ?? 1,
            },
            flattenedInputStyle?.height ? { height: flattenedInputStyle.height } : null,
          ]}>
          {digitBoxes ? (
            <DigitBoxesInput
              accessibilityLabel={label}
              placeholder={labelFloated ? placeholder : ''}
              placeholderTextColor={colors.textTertiary}
              containerStyle={[
                styles.floatingDigitInput,
                {
                  minHeight: flattenedInputStyle?.minHeight ?? 64,
                  backgroundColor: 'transparent',
                  borderWidth: 0,
                  paddingTop: 12,
                },
              ]}
              value={value}
              onFocus={handleFocus}
              onBlur={handleBlur}
              {...inputProps}
            />
          ) : (
            <View style={leadingContent ? styles.inputWithLeadingContent : undefined}>
              {leadingContent}
              <TextInput
                {...inputProps}
                value={value}
                placeholder={labelFloated ? placeholder : ''}
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel={label}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={[
                  styles.floatingTextInput,
                  leadingContent ? styles.floatingTextInputWithLeadingContent : null,
                  { color: colors.text },
                  inputStyle,
                ]}
              />
            </View>
          )}
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.floatingLabelIdle,
              {
                pointerEvents: 'none',
                opacity: labelProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [
                  { translateY: labelProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) },
                ],
              },
            ]}>
            <AppText variant="bodySmallStrong" color={colors.textSecondary}>{label}</AppText>
          </Animated.View>
          <Animated.View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.floatingLabelRaised,
              {
                pointerEvents: 'none',
                opacity: labelProgress,
                transform: [
                  { translateY: labelProgress.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) },
                ],
              },
            ]}>
            <AppText variant="caption" color={focused ? colors.primary : colors.textSecondary}>{label}</AppText>
          </Animated.View>
        </View>
      ) : digitBoxes ? (
        <DigitBoxesInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textTertiary}
          containerStyle={[
            {
              borderRadius: flattenedInputStyle?.borderRadius ?? radius.md,
              backgroundColor: flattenedInputStyle?.backgroundColor ?? colors.surface,
              borderColor: error ? colors.error : focused ? colors.primary : flattenedInputStyle?.borderColor ?? colors.border,
              borderWidth: flattenedInputStyle?.borderWidth ?? 1,
              minHeight: flattenedInputStyle?.minHeight ?? 50,
            },
            flattenedInputStyle?.height ? { height: flattenedInputStyle.height } : null,
          ]}
          value={value}
          placeholder={placeholder}
          {...inputProps}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      ) : (
        leadingContent ? (
          <View
            style={[
              styles.inputWithLeadingContent,
              styles.inputWithLeadingContentOutlined,
              {
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderColor: error ? colors.error : focused ? colors.primary : flattenedInputStyle?.borderColor ?? colors.border,
              },
            ]}>
            {leadingContent}
            <TextInput
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel={label}
              style={[
                styles.input,
                styles.inputWithLeadingContentText,
                { color: colors.text },
                inputStyle,
              ]}
              value={value}
              placeholder={placeholder}
              onFocus={handleFocus}
              onBlur={handleBlur}
              {...inputProps}
            />
          </View>
        ) : (
          <TextInput
            placeholderTextColor={colors.textTertiary}
            accessibilityLabel={label}
            style={[
              styles.input,
              {
                color: colors.text,
                borderRadius: radius.md,
                backgroundColor: colors.surface,
                borderColor: error ? colors.error : focused ? colors.primary : flattenedInputStyle?.borderColor ?? colors.border,
              },
              inputStyle,
            ]}
            value={value}
            placeholder={placeholder}
            onFocus={handleFocus}
            onBlur={handleBlur}
            {...inputProps}
          />
        )
      )}
      {error ? (
        <View style={styles.fieldMessage}>
          <AppIcon name="warning" size={13} color={colors.error} weight="medium" />
          <AppText variant="caption" color={colors.error}>
            {error}
          </AppText>
        </View>
      ) : hint ? (
        <AppText variant="caption" color={colors.textTertiary}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** Inline confirmation / error feedback. */
export function StatusBanner({
  tone,
  title,
  message,
  onDismiss,
}: {
  tone: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  onDismiss?: () => void;
}) {
  const { colors, radius } = useAppTheme();
  const palette = {
    success: { fg: colors.success, bg: colors.successSoft, icon: 'success' as IconName },
    error: { fg: colors.error, bg: colors.errorSoft, icon: 'warning' as IconName },
    info: { fg: colors.info, bg: colors.infoSoft, icon: 'info' as IconName },
  }[tone];

  return (
    <View
      accessibilityRole="alert"
      style={[styles.banner, { borderRadius: radius.md, backgroundColor: palette.bg }]}>
      <AppIcon name={palette.icon} size={18} color={palette.fg} weight="semibold" />
      <View style={styles.bannerCopy}>
        <AppText variant="bodySmallStrong" color={palette.fg}>
          {title}
        </AppText>
        {message ? (
          <AppText variant="caption" color={colors.textSecondary}>
            {message}
          </AppText>
        ) : null}
      </View>
      {onDismiss ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          hitSlop={8}
          onPress={onDismiss}>
          <AppIcon name="close" size={15} color={palette.fg} weight="medium" />
        </Pressable>
      ) : null}
    </View>
  );
}

/* -------------------------------------------------------------------- faq */

export function FaqItem({
  question,
  answer,
  expanded,
  onToggle,
}: {
  question: string;
  answer: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { colors, radius } = useAppTheme();

  return (
    <View
      style={[
        styles.faq,
        { borderRadius: radius.lg, backgroundColor: colors.surface, borderColor: colors.border },
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={question}
        onPress={onToggle}
        style={({ pressed }) => [styles.faqHeader, pressed && { opacity: 0.7 }]}>
        <AppText variant="bodyStrong" style={styles.faqQuestion}>
          {question}
        </AppText>
        <AppIcon
          name="chevronDown"
          size={18}
          color={colors.textTertiary}
          weight="medium"
          style={expanded ? styles.chevronOpen : undefined}
        />
      </Pressable>

      {expanded ? (
        <View style={[styles.faqBody, { borderTopColor: colors.border }]}>
          <AppText variant="bodySmall" color={colors.textSecondary}>
            {answer}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/* ----------------------------------------------------------------- dialog */

export type ConfirmationDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  dismissLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** Confirmation wrapper around `AppDialog` so screens share one call shape. */
export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel,
  dismissLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmationDialogProps) {
  return (
    <AppDialog
      visible={visible}
      title={title}
      message={message}
      confirmLabel={confirmLabel}
      dismissLabel={dismissLabel}
      confirmDestructive={destructive}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}

/* -------------------------------------------------------------------- pin */

/** Boxed entry display shared by PIN and one-time-code screens. */
export function PinBoxes({
  value,
  secure = true,
  length = 6,
  onChangeText,
  autoFocus = false,
  editable = true,
}: {
  value: string;
  secure?: boolean;
  length?: number;
  onChangeText?: (value: string) => void;
  autoFocus?: boolean;
  editable?: boolean;
}) {
  const { colors, radius } = useAppTheme();

  if (onChangeText) {
    return (
      <DigitBoxesInput
        accessibilityLabel={`Enter ${length}-digit ${secure ? 'PIN' : 'code'}`}
        value={value}
        secureTextEntry={secure}
        keyboardType="number-pad"
        maxLength={length}
        boxCount={length}
        autoFocus={autoFocus}
        editable={editable}
        autoComplete="off"
        onChangeText={(next) => onChangeText(next.replace(/\D/g, '').slice(0, length))}
      />
    );
  }

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${value.length} of ${length} digits entered`}
      style={styles.pinBoxes}>
      {Array.from({ length }, (_, index) => (
        <View
          key={index}
          style={[
            styles.pinBox,
            {
              borderRadius: radius.sm,
              borderColor: index < value.length ? colors.primary : colors.borderStrong,
              backgroundColor: index < value.length ? colors.primarySoft : colors.surface,
            },
          ]}>
          {index < value.length ? (
            <AppText variant="bodyStrong" color={colors.primary}>
              {secure ? '•' : value[index]}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ styles */

const styles = StyleSheet.create({
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  headerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  headerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 62,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowDisabled: {
    opacity: 0.6,
  },
  rowIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowValue: {
    maxWidth: '42%',
    textAlign: 'right',
  },
  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  securityIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  activityDot: {
    width: 8,
    height: 8,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  deviceIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  deviceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deviceName: {
    flexShrink: 1,
  },
  currentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  deviceRemove: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    gap: 6,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    ...typography.input,
  },
  floatingInputCard: {
    position: 'relative',
    justifyContent: 'center',
    marginTop: 20,
  },
  floatingTextInput: {
    width: '100%',
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingTop: 15,
    paddingBottom: 4,
    borderWidth: 0,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  inputWithLeadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  inputWithLeadingContentOutlined: {
    minHeight: 50,
    borderWidth: 1,
  },
  inputWithLeadingContentText: {
    flex: 1,
    width: undefined,
    minHeight: 48,
    borderWidth: 0,
    paddingHorizontal: spacing.sm,
    backgroundColor: 'transparent',
  },
  floatingTextInputWithLeadingContent: {
    flex: 1,
    width: undefined,
    paddingHorizontal: spacing.sm,
  },
  floatingDigitInput: {
    width: '100%',
    borderWidth: 0,
  },
  floatingLabelIdle: {
    position: 'absolute',
    top: 0,
    right: spacing.md,
    bottom: 0,
    left: spacing.md,
    justifyContent: 'center',
  },
  floatingLabelRaised: {
    position: 'absolute',
    top: -20,
    right: spacing.md,
    left: spacing.md,
  },
  fieldMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  bannerCopy: {
    flex: 1,
    gap: 2,
  },
  faq: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  faqQuestion: {
    flex: 1,
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  faqBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pinBoxes: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  pinBox: {
    width: 40,
    height: 48,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
