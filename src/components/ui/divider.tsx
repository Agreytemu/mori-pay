import { StyleSheet, View, type ViewProps } from 'react-native';

import { spacing, useAppTheme } from '@/theme';

export type DividerProps = {
  /** Inset the divider from the leading edge, used to align with row content. */
  inset?: number;
  style?: ViewProps['style'];
};

export function Divider({ inset = 0, style }: DividerProps) {
  const { colors } = useAppTheme();

  return (
    <View
      accessibilityRole="none"
      style={[
        styles.base,
        { backgroundColor: colors.border, marginLeft: inset },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    marginVertical: spacing.none,
  },
});
