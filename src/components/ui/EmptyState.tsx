import { StyleSheet, View } from 'react-native';

import { AppIllustration, type AppIllustrationName } from '@/components/ui/AppIllustration';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { SecondaryButton } from '@/components/ui/button';
import type { IconName } from '@/constants/icons';
import { useAppTheme } from '@/theme';

export type EmptyStateProps = {
  icon?: IconName;
  illustration?: AppIllustrationName;
  title: string;
  description?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  /** Compensates for the tab bar when the empty state sits in a scrolling list. */
  compact?: boolean;
};

/**
 * Shown when a list has no items. Keeps the screen from collapsing and always
 * offers a way forward when an action is possible.
 */
export function EmptyState({
  icon = 'emptyInbox',
  illustration,
  title,
  description,
  actionLabel,
  onActionPress,
  compact = false,
}: EmptyStateProps) {
  const { colors, space, radius } = useAppTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${description ?? ''}`}
      style={[styles.container, { gap: space.md, paddingVertical: compact ? space.xl : space.xxl }]}>
      {illustration ? (
        <AppIllustration
          name={illustration}
          width={compact ? 132 : 176}
          height={compact ? 96 : 128}
          style={styles.illustration}
        />
      ) : (
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.surfaceMuted, borderRadius: radius.circle },
          ]}>
          <AppIcon name={icon} size={compact ? 26 : 30} color={colors.textTertiary} weight="regular" />
        </View>
      )}

      <View style={[styles.copy, { gap: space.xs }]}>
        <AppText variant="title3" align="center">
          {title}
        </AppText>
        {description ? (
          <AppText variant="bodySmall" color={colors.textSecondary} align="center">
            {description}
          </AppText>
        ) : null}
      </View>

      {actionLabel && onActionPress ? (
        <SecondaryButton label={actionLabel} onPress={onActionPress} size="sm" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  badge: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustration: {
    alignSelf: 'center',
  },
  copy: {
    maxWidth: 300,
  },
  action: {
    marginTop: 4,
  },
});