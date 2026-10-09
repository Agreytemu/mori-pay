import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useAppTheme } from '@/theme';

export type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Loading placeholder.
 *
 * A single low-key opacity pulse — enough to signal "loading" without the
 * shimmer effects that make small screens feel busy.
 */
export function Skeleton({ width = '100%', height = 14, borderRadius = radius.sm, style }: SkeletonProps) {
  const { colors } = useAppTheme();
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityRole="none"
      style={[
        styles.base,
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.skeleton,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
        },
        style,
      ]}
    />
  );
}

export type SkeletonRowProps = {
  /** Number of placeholder rows to render. */
  count?: number;
};

/** Placeholder rows matching the shape of a ledger list. */
export function SkeletonRows({ count = 5 }: SkeletonRowProps) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={40} height={40} borderRadius={radius.md} />
          <View style={styles.rowCopy}>
            <Skeleton width="70%" height={13} />
            <Skeleton width="45%" height={11} />
          </View>
          <View style={styles.rowTrailing}>
            <Skeleton width={72} height={13} />
            <Skeleton width={38} height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
  list: {
    gap: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  rowTrailing: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
});
