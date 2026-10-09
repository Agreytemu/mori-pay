import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { hitTarget, radius, spacing, useAppTheme, type AppIconName } from '@/theme';

type IconButtonVariant = 'surface' | 'ghost' | 'inverse';

export type IconButtonProps = {
  icon: AppIconName;
  onPress?: () => void;
  accessibilityLabel: string;
  variant?: IconButtonVariant;
  size?: 'sm' | 'md';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Circular or squircle icon-only control with a full-size touch target. */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'surface',
  size = 'md',
  disabled = false,
  style,
  testID,
}: IconButtonProps) {
  const { colors } = useAppTheme();

  const tone = (() => {
    switch (variant) {
      case 'ghost':
        return { background: 'transparent', content: colors.textSecondary };
      case 'inverse':
        return { background: 'rgba(255, 255, 255, 0.16)', content: colors.textInverse };
      case 'surface':
      default:
        return { background: colors.surface, content: colors.text };
    }
  })();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      hitSlop={spacing.xs}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: tone.background },
        variant === 'surface' && { borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}>
      <AppIcon name={icon} size={size === 'sm' ? 18 : 20} color={tone.content} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  sm: {
    width: hitTarget.min - spacing.sm,
    height: hitTarget.min - spacing.sm,
  },
  md: {
    width: hitTarget.min,
    height: hitTarget.min,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
});
