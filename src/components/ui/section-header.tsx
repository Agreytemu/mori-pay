import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { GhostButton } from '@/components/ui/button';
import { spacing } from '@/theme';

export type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

/** Title row that introduces a group of content, with an optional action. */
export function SectionHeader({ title, subtitle, actionLabel, onActionPress }: SectionHeaderProps) {
  return (
    <View style={styles.root}>
      <View style={styles.copy}>
        <AppText variant="heading" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" tone="secondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {actionLabel && onActionPress ? (
        <GhostButton
          label={actionLabel}
          icon="chevronRight"
          onPress={onActionPress}
          accessibilityLabel={actionLabel}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 32,
  },
  copy: {
    flexShrink: 1,
    gap: 2,
  },
});
