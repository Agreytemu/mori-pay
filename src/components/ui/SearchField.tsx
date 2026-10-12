import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { useAppTheme } from '@/theme';
import { typography } from '@/theme/typography';

export type SearchFieldProps = Omit<TextInputProps, 'style'> & {
  onClear?: () => void;
  /** Shows the filter toggle on the right. */
  trailing?: React.ReactNode;
};

/** Themed search input with a leading glyph and optional clear affordance. */
export function SearchField({ onClear, trailing, value, placeholder, ...rest }: SearchFieldProps) {
  const { colors, space, radius } = useAppTheme();

  return (
    <View style={[styles.container, { gap: space.sm }]}>
      <View
        style={[
          styles.inputWrap,
          {
            backgroundColor: colors.surfaceMuted,
            borderRadius: radius.pill,
            paddingHorizontal: space.md,
            gap: space.sm,
          },
        ]}>
        <AppIcon name="search" size={17} color={colors.textTertiary} weight="regular" />
        <TextInput
          value={value}
          placeholder={placeholder ?? 'Search'}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel={placeholder ?? 'Search'}
          style={[styles.input, { color: colors.text }]}
          {...rest}
        />
        {value && value.length > 0 && onClear ? (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={10}
            style={({ pressed }) => [
              styles.clear,
              { backgroundColor: pressed ? colors.borderStrong : colors.surfacePressed },
            ]}>
            <AppIcon name="close" size={11} color={colors.textSecondary} weight="semibold" />
          </Pressable>
        ) : null}
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
    paddingVertical: 6,
  },
  input: {
    flex: 1,
    ...typography.inputSmall,
    padding: 0,
    minWidth: 0,
  },
  clear: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});