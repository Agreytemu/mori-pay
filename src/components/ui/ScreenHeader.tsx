import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import type { IconName } from '@/constants/icons';
import { layout, radius, spacing, useAppTheme } from '@/theme';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Renders a back affordance and wires it to this handler. */
  onBack?: () => void;
  /** Trailing slot: icon buttons or text actions. */
  right?: ReactNode;
  bordered?: boolean;
};

/**
 * Header shared by every pushed screen: optional circular back button, a
 * two-line title block and a trailing action slot.
 *
 * The header is always 60pt tall so titles stay on the same optical baseline
 * whether or not an action is present.
 */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  bordered = false,
}: ScreenHeaderProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.root,
        { borderBottomColor: colors.border },
        bordered && { borderBottomWidth: StyleSheet.hairlineWidth },
      ]}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [
            styles.back,
            {
              borderRadius: radius.circle,
              backgroundColor: pressed ? colors.surfacePressed : colors.surfaceMuted,
            },
          ]}>
          <AppIcon name="chevronLeft" size={19} color={colors.text} weight="semibold" />
        </Pressable>
      ) : (
        <View style={styles.back} />
      )}

      <View style={styles.copy}>
        <AppText variant="title2" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color={colors.textSecondary} numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {right ? <View style={styles.right}>{right}</View> : <View style={styles.right} />}
    </View>
  );
}

/** Small pill used for header actions (`Edit`, `Sign out`, …). */
export function HeaderAction({
  label,
  icon,
  onPress,
  tone = 'default',
}: {
  label?: string;
  icon?: IconName;
  onPress: () => void;
  tone?: 'default' | 'destructive';
}) {
  const { colors, radius } = useAppTheme();
  const foreground = tone === 'destructive' ? colors.error : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Action'}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          borderRadius: radius.pill,
          backgroundColor: pressed ? colors.surfacePressed : colors.surfaceMuted,
        },
      ]}>
      {icon ? <AppIcon name={icon} size={15} color={foreground} weight="semibold" /> : null}
      {label ? (
        <AppText variant="caption" color={foreground}>
          {label}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    minHeight: layout.headerHeight,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  back: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 38,
    justifyContent: 'flex-end',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
});
