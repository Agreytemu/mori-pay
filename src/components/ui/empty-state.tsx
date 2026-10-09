import { StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { radius, spacing, useAppTheme, type AppIconName } from '@/theme';

export type EmptyStateProps = {
  icon?: AppIconName;
  title: string;
  message: string;
  actionLabel?: string;
  onActionPress?: () => void;
  secondaryActionLabel?: string;
  onSecondaryActionPress?: () => void;
  compact?: boolean;
};

/** Shown when a list has nothing to display. */
export function EmptyState({
  icon = 'emptyInbox',
  title,
  message,
  actionLabel,
  onActionPress,
  secondaryActionLabel,
  onSecondaryActionPress,
  compact = false,
}: EmptyStateProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.root, compact && styles.compact]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceMuted }]}>
        <AppIcon name={icon} size={compact ? 22 : 26} color={colors.textTertiary} />
      </View>

      <View style={styles.copy}>
        <AppText variant="subheading" style={styles.centered} numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant="caption" tone="secondary" style={styles.centered}>
          {message}
        </AppText>
      </View>

      {actionLabel && onActionPress ? (
        <View style={styles.actions}>
          <PrimaryButton label={actionLabel} onPress={onActionPress} size="md" fullWidth={false} />
          {secondaryActionLabel && onSecondaryActionPress ? (
            <SecondaryButton
              label={secondaryActionLabel}
              onPress={onSecondaryActionPress}
              size="md"
              fullWidth={false}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export type ErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

/** Shown when a request fails. */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.root}>
      <View style={[styles.iconWrap, { backgroundColor: colors.errorSoft }]}>
        <AppIcon name="errorState" size={26} color={colors.error} />
      </View>

      <View style={styles.copy}>
        <AppText variant="subheading" style={styles.centered} numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant="caption" tone="secondary" style={styles.centered}>
          {message}
        </AppText>
      </View>

      {onRetry ? <SecondaryButton label={retryLabel} onPress={onRetry} size="md" fullWidth={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  compact: {
    paddingVertical: spacing.lg,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    gap: spacing.xs,
    maxWidth: 280,
  },
  centered: {
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
});
