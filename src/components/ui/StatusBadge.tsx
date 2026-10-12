import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import type { IconName } from '@/constants/icons';
import { useAppTheme, useStateTone, type StateTone } from '@/theme';
import { typography } from '@/theme/typography';

export type StatusBadgeProps = {
  label: string;
  tone?: StateTone;
  /** Leading glyph, e.g. a check for completed transfers. */
  icon?: IconName;
  size?: 'sm' | 'md';
};

/** Compact state pill used for transaction statuses and inline flags. */
export function StatusBadge({ label, tone = 'neutral', icon, size = 'md' }: StatusBadgeProps) {
  const { space, radius } = useAppTheme();
  const toneColors = useStateTone(tone);

  const compact = size === 'sm';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`Status: ${label}`}
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        {
          backgroundColor: toneColors.background,
          borderColor: toneColors.border,
          borderRadius: radius.pill,
          paddingHorizontal: compact ? space.sm : space.md,
          paddingVertical: compact ? 2 : 3,
          gap: 4,
        },
      ]}>
      {icon ? <AppIcon name={icon} size={compact ? 11 : 13} color={toneColors.foreground} weight="semibold" /> : null}
      <AppText
        variant="overline"
        color={toneColors.foreground}
        style={compact ? styles.labelCompact : undefined}
        numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  labelCompact: {
    ...typography.microLabel,
    letterSpacing: 0.4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
});

/** Small selectable pill used for search/filter chips. */
export function FilterChip({
  label,
  selected,
  onPress,
  count,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  count?: number;
}) {
  const { colors, space, radius } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: radius.pill,
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          backgroundColor: selected
            ? colors.primary
            : pressed
              ? colors.surfacePressed
              : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          gap: 6,
        },
      ]}>
      <AppText
        variant="bodySmallStrong"
        color={selected ? colors.onPrimary : colors.textSecondary}>
        {label}
      </AppText>
      {count !== undefined ? (
        <AppText variant="bodySmall" color={selected ? colors.onPrimary : colors.textTertiary}>
          {count}
        </AppText>
      ) : null}
    </Pressable>
  );
}