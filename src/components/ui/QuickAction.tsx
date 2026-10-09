import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/card';
import type { IconName } from '@/constants/icons';
import { useAppTheme, useStateTone, type StateTone } from '@/theme';

export type QuickActionVariant = 'grid' | 'tile';

export type QuickActionProps = {
  icon: IconName;
  label: string;
  description?: string;
  onPress?: () => void;
  variant?: QuickActionVariant;
  /** Tint of the icon tile and label. */
  tone?: StateTone;
  /** Compact tiles are used on the Home screen where four actions fit in a row. */
  compact?: boolean;
  disabled?: boolean;
};

/**
 * One money-movement entry point. `compact` renders the Home-screen grid tile,
 * the default renders the full-width Payments-screen card.
 */
export function QuickAction({
  icon,
  label,
  description,
  onPress,
  variant = 'tile',
  tone = 'primary',
  compact = false,
  disabled,
}: QuickActionProps) {
  const { colors, space, radius } = useAppTheme();
  const toneColors = useStateTone(tone);

  const iconTile = (
    <View
      style={[
        styles.iconTile,
        compact && styles.iconTileCompact,
        {
          backgroundColor: toneColors.background,
          borderRadius: compact ? radius.md : radius.lg,
        },
      ]}>
      <AppIcon
        name={icon}
        size={compact ? 20 : 22}
        color={toneColors.foreground}
        weight="semibold"
      />
    </View>
  );

  if (compact) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={description ? `${label}. ${description}` : label}
        accessibilityState={{ disabled: !!disabled }}
        style={({ pressed }) => [
          styles.gridItem,
          {
            backgroundColor: pressed ? colors.surfacePressed : 'transparent',
            borderRadius: radius.lg,
            paddingVertical: space.sm,
            gap: space.sm,
          },
          disabled && styles.disabled,
        ]}>
        {iconTile}
        <AppText variant="bodySmallStrong" numberOfLines={2} align="center">
          {label}
        </AppText>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={description ? `${label}. ${description}` : label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => (pressed ? styles.pressed : null)}>
      <Card
        variant="elevated"
        style={[styles.tile, { padding: space.base, gap: space.md }]}>
        <View style={styles.tileHeader}>
          {iconTile}
          <AppIcon name="chevronRight" size={18} color={colors.textTertiary} weight="medium" />
        </View>
        <View style={styles.tileCopy}>
          <AppText variant="title3">{label}</AppText>
          {description ? (
            <AppText variant="bodySmall" color={colors.textSecondary}>
              {description}
            </AppText>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gridItem: {
    flex: 1,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tile: {
    width: '100%',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tileCopy: {
    gap: 2,
  },
  iconTile: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileCompact: {
    width: 40,
    height: 40,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.4,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
  },
});

/** Evenly distributes quick actions across the available width. */
export function QuickActionRow({
  actions,
  gap = 2,
}: {
  actions: QuickActionProps[];
  gap?: number;
}) {
  const { space } = useAppTheme();

  return (
    <View style={[styles.row, { gap }]}>
      {actions.map((action) => (
        <View key={action.label} style={{ flex: 1, maxWidth: space.huge * 4 }}>
          <QuickAction {...action} variant="grid" compact />
        </View>
      ))}
    </View>
  );
}