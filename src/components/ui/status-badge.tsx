import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { radius, spacing, useStateTone, type AppIconName, type StateTone } from '@/theme';

export type StatusBadgeProps = {
  status: 'completed' | 'pending' | 'failed' | 'cancelled' | 'reversed' | 'verified';
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

type BadgeTone = {
  label: string;
  tone: StateTone;
  icon?: AppIconName;
};

const STATUS_TONES: Record<StatusBadgeProps['status'], BadgeTone> = {
  completed: { label: 'Completed', tone: 'success', icon: 'success' },
  pending: { label: 'Pending', tone: 'warning', icon: 'pending' },
  failed: { label: 'Failed', tone: 'error', icon: 'failed' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  reversed: { label: 'Reversed', tone: 'neutral' },
  verified: { label: 'Verified', tone: 'primary', icon: 'success' },
};

/** Compact status pill used on ledger rows and account summaries. */
export function StatusBadge({ status, size = 'sm', style }: StatusBadgeProps) {
  const tone = STATUS_TONES[status];
  const toneColors = useStateTone(tone.tone);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={tone.label}
      style={[
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: toneColors.background },
        style,
      ]}>
      {tone.icon ? (
        <AppIcon name={tone.icon} size={size === 'sm' ? 12 : 14} color={toneColors.foreground} />
      ) : null}
      <AppText
        variant="caption"
        numberOfLines={1}
        style={[tone.label.length > 8 && styles.compactLabel, { color: toneColors.foreground }]}>
        {tone.label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    gap: spacing.xs,
  },
  sm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  md: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  compactLabel: {
    letterSpacing: -0.2,
  },
});
