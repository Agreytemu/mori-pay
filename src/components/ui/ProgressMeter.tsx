import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/theme';

export type ProgressMeterProps = {
  /** 0–100. */
  value: number;
  tone?: 'primary' | 'success' | 'warning' | 'error';
  height?: number;
  label?: string;
  valueLabel?: string;
};

/** Thin horizontal meter used for the daily limit and similar ratios. */
export function ProgressMeter({
  value,
  tone = 'primary',
  height = 6,
  label,
  valueLabel,
}: ProgressMeterProps) {
  const { colors, space } = useAppTheme();

  const fill =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'error'
          ? colors.error
          : colors.primary;

  const clamped = Math.min(100, Math.max(0, value));

  return (
    <View style={{ gap: space.sm }}>
      {label || valueLabel ? (
        <View style={styles.labels}>
          {label ? (
            <AppText variant="bodySmall" color={colors.textSecondary}>
              {label}
            </AppText>
          ) : null}
          {valueLabel ? (
            <AppText variant="bodySmallStrong" color={colors.text}>
              {valueLabel}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
        style={[
          styles.track,
          { height, borderRadius: height / 2, backgroundColor: colors.surfaceMuted },
        ]}>
        <View
          style={[
            styles.fill,
            {
              width: `${clamped}%`,
              backgroundColor: fill,
              borderRadius: height / 2,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});