import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { Divider } from '@/components/ui/divider';
import { radius, spacing, useAppTheme, type AppIconName } from '@/theme';

type RowTone = 'default' | 'destructive';

export type SettingsRowProps = {
  icon?: AppIconName;
  label: string;
  /** Secondary line under the label. */
  description?: string;
  /** Right-aligned value, e.g. the phone number. */
  value?: string;
  onPress?: () => void;
  /** Renders a switch instead of a chevron. */
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  /** Any custom trailing content, replacing the chevron. */
  accessory?: ReactNode;
  showDivider?: boolean;
  tone?: RowTone;
  testID?: string;
};

/** One line inside a settings group. */
export function SettingsRow({
  icon,
  label,
  description,
  value,
  onPress,
  switchValue,
  onSwitchChange,
  accessory,
  showDivider = false,
  tone = 'default',
  testID,
}: SettingsRowProps) {
  const { colors } = useAppTheme();
  const isDestructive = tone === 'destructive';
  const contentColor = isDestructive ? colors.error : colors.text;
  const iconColor = isDestructive ? colors.error : colors.textSecondary;

  const body = (
    <>
      {icon ? (
        <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
          <AppIcon name={icon} size={17} weight="medium" color={iconColor} />
        </View>
      ) : null}

      <View style={styles.copy}>
        <AppText variant="bodyMedium" numberOfLines={1} style={{ color: contentColor }}>
          {label}
        </AppText>
        {description ? (
          <AppText variant="caption" tone="secondary" numberOfLines={2}>
            {description}
          </AppText>
        ) : null}
      </View>

      {value ? (
        <AppText variant="caption" tone="muted" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}

      {typeof switchValue === 'boolean' ? (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          accessibilityLabel={label}
          trackColor={{ false: colors.backgroundSunken, true: colors.primary }}
          thumbColor={colors.surface}
          ios_backgroundColor={colors.backgroundSunken}
        />
      ) : (
        accessory
      )}

      {!switchValue && accessory === undefined && onPress ? (
        <AppIcon name="chevronRight" size={16} color={colors.textTertiary} />
      ) : null}
    </>
  );

  return (
    <View>
      {onPress && typeof switchValue !== 'boolean' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={onPress}
          testID={testID}
          style={({ pressed }) => [styles.root, pressed && styles.pressed]}>
          {body}
        </Pressable>
      ) : (
        <View style={styles.root} testID={testID}>
          {body}
        </View>
      )}

      {showDivider ? <Divider inset={spacing.lg} /> : null}
    </View>
  );
}

export type SettingsGroupProps = {
  /** Optional section label rendered above the card. */
  title?: string;
  children: ReactNode;
};

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  value: {
    maxWidth: '45%',
    textAlign: 'right',
  },
});
