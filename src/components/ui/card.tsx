import { StyleSheet, View, type StyleProp, type ViewProps } from 'react-native';
import type { ReactNode } from 'react';

import { useAppTheme } from '@/theme';
import { cardShadow } from '@/utils/ui';

export type CardProps = ViewProps & {
  variant?: 'elevated' | 'outlined' | 'plain' | 'muted';
  padding?: number;
  radius?: number;
  style?: StyleProp<ViewProps['style']>;
};

export function Card({
  variant = 'elevated',
  padding,
  radius,
  style,
  ...rest
}: CardProps) {
  const { colors, radius: r, scheme } = useAppTheme();
  const backgroundColor =
    variant === 'plain'
      ? 'transparent'
      : variant === 'muted'
        ? colors.surfaceMuted
        : colors.surface;
  const borderColor = variant === 'outlined' ? colors.border : 'transparent';

  return (
    <View
      style={[
        styles.base,
        { backgroundColor, borderRadius: radius ?? r.xl },
        variant === 'outlined' && { borderWidth: 1, borderColor },
        variant === 'elevated' && cardShadow(scheme === 'dark'),
        padding !== undefined && { padding },
        style,
      ]}
      {...rest}
    />
  );
}

export function CardStack({
  gap,
  children,
  style,
  ...rest
}: ViewProps & { gap?: number; children?: ReactNode }) {
  const { space } = useAppTheme();

  return (
    <View style={[styles.stack, { gap: gap ?? space.md }, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
  stack: {
    width: '100%',
  },
});
