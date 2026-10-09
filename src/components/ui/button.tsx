import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { AppIcon, type AppIconWeight } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import type { IconName } from '@/constants/icons';
import { useAppTheme } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconPosition?: 'leading' | 'trailing';
  loading?: boolean;
  block?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  hint?: string;
  children?: ReactNode;
};

const ICON_SIZE: Record<Size, number> = { sm: 16, md: 18, lg: 20 };
const ICON_WEIGHT: Record<Size, AppIconWeight> = {
  sm: 'medium',
  md: 'semibold',
  lg: 'semibold',
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'leading',
  loading = false,
  block = false,
  fullWidth = false,
  disabled,
  style,
  hint,
  children,
  ...rest
}: ButtonProps) {
  const { colors, radius, space, layout } = useAppTheme();
  const isDisabled = disabled || loading;
  const surfaces: Record<Variant, { background: string; pressed: string; foreground: string; border?: string }> = {
    primary: {
      background: colors.primary,
      pressed: colors.primaryPressed,
      foreground: colors.onPrimary,
    },
    secondary: {
      background: colors.surface,
      pressed: colors.surfacePressed,
      foreground: colors.text,
      border: colors.borderStrong,
    },
    ghost: {
      background: 'transparent',
      pressed: colors.surfaceMuted,
      foreground: colors.primary,
    },
    danger: {
      background: colors.errorSoft,
      pressed: colors.errorSoft,
      foreground: colors.error,
      border: colors.errorBorder,
    },
  };
  const surface = surfaces[variant];
  const heights: Record<Size, number> = {
    sm: 36,
    md: layout.minTouchTarget,
    lg: 52,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed ? surface.pressed : surface.background,
          borderColor: surface.border ?? 'transparent',
          borderWidth: surface.border ? 1 : 0,
          borderRadius: radius.pill,
          minHeight: heights[size],
          paddingHorizontal: size === 'sm' ? space.base : space.lg,
          gap: space.sm,
        },
        (block || fullWidth) && styles.block,
        isDisabled && styles.disabled,
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator size="small" color={surface.foreground} />
      ) : (
        <>
          {icon && iconPosition === 'leading' ? (
            <AppIcon name={icon} size={ICON_SIZE[size]} color={surface.foreground} weight={ICON_WEIGHT[size]} />
          ) : null}
          <View style={styles.labelGroup}>
            <AppText
              variant={size === 'sm' ? 'buttonSmall' : 'button'}
              color={surface.foreground}
              align="center">
              {label}
            </AppText>
            {hint ? (
              <AppText variant="bodySmall" color={colors.textSecondary} align="center">
                {hint}
              </AppText>
            ) : null}
          </View>
          {icon && iconPosition === 'trailing' ? (
            <AppIcon name={icon} size={ICON_SIZE[size]} color={surface.foreground} weight={ICON_WEIGHT[size]} />
          ) : null}
          {children}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  block: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.45,
  },
  labelGroup: {
    alignItems: 'center',
    flexShrink: 1,
  },
});

export function PrimaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="primary" {...props} />;
}

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="secondary" {...props} />;
}

export function GhostButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="ghost" {...props} />;
}

export function DangerButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button variant="danger" {...props} />;
}
