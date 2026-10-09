import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import type { IconName } from '@/constants/icons';
import { useAppTheme, useStateTone, type StateTone } from '@/theme';

export type SettingsRowProps = {
  icon?: IconName;
  iconTone?: StateTone;
  label: string;
  /** Secondary line under the label. */
  description?: string;
  /** Right-hand text, e.g. a masked phone number. */
  value?: string;
  /** Switch replaces the chevron. */
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  /** Custom right-hand content, e.g. a segmented control. */
  trailing?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  isLast?: boolean;
};

/**
 * Settings / account row. Used by the Profile screen so security, notification,
 * appearance, help and about blocks all share one row implementation.
 */
export function SettingsRow({
  icon,
  iconTone = 'neutral',
  label,
  description,
  value,
  switchValue,
  onSwitchChange,
  trailing,
  onPress,
  showChevron = false,
  destructive = false,
  isLast = false,
}: SettingsRowProps) {
  const { colors, space, radius, layout } = useAppTheme();
  const toneColors = useStateTone(destructive ? 'error' : iconTone);

  const foreground = destructive ? colors.error : colors.text;

  const leading = icon ? (
    <View
      style={[
        styles.iconTile,
        {
          backgroundColor: toneColors.background,
          borderRadius: radius.sm + 2,
        },
      ]}>
      <AppIcon name={icon} size={18} color={toneColors.foreground} weight="medium" />
    </View>
  ) : null;

  const content = (
    <>
      {leading}
      <View style={styles.copy}>
        <AppText variant="body" color={foreground} numberOfLines={1}>
          {label}
        </AppText>
        {description ? (
          <AppText variant="bodySmall" color={colors.textTertiary} numberOfLines={2}>
            {description}
          </AppText>
        ) : null}
      </View>

      {value ? (
        <AppText variant="bodySmall" color={colors.textTertiary} numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}

      {trailing}

      {typeof switchValue === 'boolean' && onSwitchChange ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          accessibilityLabel={label}
          trackColor={{ false: colors.borderStrong, true: colors.primary }}
          thumbColor={colors.surface}
          ios_backgroundColor={colors.borderStrong}
        />
      ) : showChevron ? (
        <AppIcon name="chevronRight" size={17} color={colors.textTertiary} weight="medium" />
      ) : null}
    </>
  );

  const rowStyle = [
    styles.row,
    {
      gap: space.md,
      paddingVertical: space.md,
      paddingHorizontal: space.base,
      minHeight: layout.listRowMinHeight,
      borderBottomColor: colors.divider,
      borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
    },
  ];

  if (!onPress) {
    return <View style={rowStyle}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [rowStyle, pressed && { backgroundColor: colors.surfacePressed }]}>
      {content}
    </Pressable>
  );
}

/** Groups rows into one bordered surface. */
export function SettingsGroup({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { colors, radius, space } = useAppTheme();

  return (
    <View style={styles.groupWrap}>
      <View
        style={[
          styles.group,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.lg,
          },
        ]}>
        {children}
      </View>
      {footer ? (
        <AppText
          variant="bodySmall"
          color={colors.textTertiary}
          style={{ paddingHorizontal: space.xs, paddingTop: space.sm }}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  group: {
    width: '100%',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  groupWrap: {
    width: '100%',
  },
  copy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  value: {
    maxWidth: '45%',
    textAlign: 'right',
  },
  iconTile: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});