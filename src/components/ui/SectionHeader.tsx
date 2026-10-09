import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/theme';

export type SectionHeaderProps = {
  title: string;
  /** Optional supporting copy under the title. */
  subtitle?: string;
  /** Right-hand text, e.g. a total. */
  meta?: string;
  /** Renders a tappable "View all" affordance. */
  actionLabel?: string;
  onActionPress?: () => void;
  style?: object;
};

/**
 * Section divider used above every grouped block on every screen so headings,
 * actions and vertical rhythm stay identical app-wide.
 */
export function SectionHeader({
  title,
  subtitle,
  meta,
  actionLabel,
  onActionPress,
  style,
}: SectionHeaderProps) {
  const { colors, space } = useAppTheme();

  return (
    <View style={[styles.container, { gap: space.sm, marginBottom: space.md }, style]}>
      <View style={styles.copy}>
        <AppText variant="title2">{title}</AppText>
        {subtitle ? (
          <AppText variant="bodySmall" color={colors.textSecondary}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {meta ? (
        <AppText variant="bodySmallStrong" color={colors.textTertiary}>
          {meta}
        </AppText>
      ) : null}

      {actionLabel && onActionPress ? (
        <Pressable
          onPress={onActionPress}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          hitSlop={10}
          style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
          <AppText variant="bodySmallStrong" color={colors.primary}>
            {actionLabel}
          </AppText>
          <AppIcon name="chevronRight" size={14} color={colors.primary} weight="semibold" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  copy: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    marginRight: -4,
  },
  actionPressed: {
    opacity: 0.6,
  },
});