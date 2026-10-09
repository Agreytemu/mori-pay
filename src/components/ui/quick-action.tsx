import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { radius, spacing, useAppTheme, type AppIconName } from '@/theme';

export type QuickActionProps = {
  label: string;
  icon: AppIconName;
  onPress?: () => void;
  /** `brand` fills the tile with the brand colour, `surface` keeps it neutral. */
  variant?: 'brand' | 'surface';
  accessibilityLabel?: string;
  testID?: string;
};

/**
 * Compact money-movement entry point (Send, Receive, Pay, Request).
 *
 * Designed to sit in a row of four on small Android screens, with a touch
 * target larger than the visual tile.
 */
export function QuickAction({
  label,
  icon,
  onPress,
  variant = 'surface',
  accessibilityLabel,
  testID,
}: QuickActionProps) {
  const { colors } = useAppTheme();

  const isBrand = variant === 'brand';
  const iconBackground = isBrand ? colors.primary : colors.surfaceMuted;
  const iconColor = isBrand ? colors.onPrimary : colors.primary;
  const labelColor = isBrand ? colors.textInverse : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={!onPress}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.root, pressed && styles.pressed]}>
      <View
        style={[
          styles.tile,
          {
            backgroundColor: iconBackground,
            borderColor: isBrand ? colors.primary : colors.border,
          },
        ]}>
        <AppIcon name={icon} size={21} weight="semibold" color={iconColor} />
      </View>

      <AppText variant="caption" numberOfLines={1} style={[styles.label, { color: labelColor }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tile: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  pressed: {
    opacity: 0.6,
  },
});
