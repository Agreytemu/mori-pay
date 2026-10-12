import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { numericText, useAppTheme, type TypographyVariant } from '@/theme';

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: string;
  /** Renders tabular digits, e.g. for financial values and account details. */
  numeric?: boolean;
  align?: TextStyle['textAlign'];
  /** Truncates after one line; used for counterparty names. */
  numberOfLines?: number;
};

/**
 * Typography primitive. Every piece of text in the app renders through here so
 * the type ramp stays consistent and colour tokens are always theme-derived.
 */
export function AppText({
  variant = 'body',
  color,
  numeric = false,
  align,
  style,
  numberOfLines,
  ...rest
}: AppTextProps) {
  const { colors, typography } = useAppTheme();

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        typography[variant],
        { color: color ?? colors.text },
        numeric && styles.numeric,
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  numeric: numericText,
});