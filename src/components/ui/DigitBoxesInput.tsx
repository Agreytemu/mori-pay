import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAppTheme } from '@/theme';

type DigitBoxesInputProps = Omit<TextInputProps, 'style'> & {
  boxCount?: number;
  containerStyle?: StyleProp<ViewStyle>;
  cellFontSize?: number;
};

export function DigitBoxesInput({
  value = '',
  placeholder,
  maxLength,
  boxCount,
  containerStyle,
  cellFontSize = 16,
  secureTextEntry,
  onChangeText,
  onFocus,
  onBlur,
  editable = true,
  ...inputProps
}: DigitBoxesInputProps) {
  const { colors, radius, space } = useAppTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [focused, setFocused] = useState(false);
  const [width, setWidth] = useState(0);
  const characters = useMemo(() => value.replace(/\s/g, '').split(''), [value]);
  const placeholderCharacters = useMemo(
    () => (placeholder ?? '').replace(/\s/g, '').split(''),
    [placeholder],
  );
  const count = Math.max(
    1,
    boxCount ?? maxLength ?? Math.max(6, characters.length, placeholderCharacters.length),
  );
  const gap = space.xxs;
  const contentWidth = Math.max(0, width - 4);
  const cellWidth = Math.max(14, Math.min(46, (contentWidth - gap * (count - 1)) / count));
  const cellTextSize = Math.min(cellFontSize, Math.max(11, cellWidth - 4));

  useEffect(() => {
    if (characters.length > 0) {
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
    }
  }, [characters.length]);

  return (
    <View
      onLayout={({ nativeEvent }) => setWidth(nativeEvent.layout.width)}
      style={[
        styles.root,
        {
          minHeight: 52,
          borderRadius: radius.md,
          backgroundColor: editable ? colors.surface : colors.surfaceMuted,
        },
        containerStyle,
      ]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        scrollEnabled={false}
        contentContainerStyle={[styles.cells, { gap, minWidth: contentWidth || undefined }]}
        showsHorizontalScrollIndicator={false}
        pointerEvents="none">
        {Array.from({ length: count }, (_, index) => {
          const character = characters[index];
          const placeholderCharacter = placeholderCharacters[index];
          const isFilled = character !== undefined;

          return (
            <View
              key={index}
              style={[
                styles.cell,
                {
                  width: cellWidth,
                  height: 46,
                  borderRadius: radius.sm,
                  borderColor: focused && index === characters.length ? colors.primary : colors.border,
                  backgroundColor: colors.background,
                },
                !editable && { backgroundColor: colors.surfaceMuted },
              ]}>
              <AppText
                variant="bodySmallStrong"
                color={isFilled ? colors.text : colors.textTertiary}
                style={{ fontSize: cellTextSize, lineHeight: cellTextSize + 4 }}
                numberOfLines={1}>
                {isFilled ? (secureTextEntry ? '•' : character) : placeholderCharacter ?? ''}
              </AppText>
            </View>
          );
        })}
      </ScrollView>
      <TextInput
        {...inputProps}
        value={value}
        placeholder=""
        maxLength={maxLength}
        secureTextEntry={secureTextEntry}
        editable={editable}
        accessibilityLabel={inputProps.accessibilityLabel}
        selectionColor="transparent"
        onChangeText={onChangeText}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={styles.hiddenInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cells: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cell: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  hiddenInput: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.015,
    color: 'transparent',
    padding: 0,
    margin: 0,
  },
});
