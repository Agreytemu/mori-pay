import { StyleSheet, Text, type TextProps } from 'react-native';

import { numericText, typography, useAppTheme, type TypographyVariant } from '@/theme';

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'brand'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'inverse'
  | 'disabled';

export type AppTextProps = TextProps & {
  /** Typographic level from the design tokens. */
  variant?: TypographyVariant;
  /** Semantic colour role. */
  tone?: TextTone;
  /** Renders tabular figures — use for money and any aligned number. */
  numeric?: boolean;
  uppercase?: boolean;
};

/**
 * The only text primitive in the app.
 *
 * Every string in the UI goes through `AppText` so the type hierarchy and the
 * light/dark palette stay consistent.
 */
export function AppText({
  variant = 'body',
  tone = 'primary',
  numeric = false,
  uppercase = false,
  style,
  ...rest
}: AppTextProps) {
  const { colors } = useAppTheme();

  return (
    <Text
      {...rest}
      style={[
        typography[variant],
        { color: toneColor(colors, tone) },
        numeric && styles.numeric,
        uppercase && styles.uppercase,
        style,
      ]}
    />
  );
}

function toneColor(
  colors: ReturnType<typeof useAppTheme>['colors'],
  tone: TextTone
): string {
  switch (tone) {
    case 'secondary':
      return colors.textSecondary;
    case 'muted':
      return colors.textTertiary;
    case 'brand':
      return colors.primary;
    case 'success':
      return colors.success;
    case 'warning':
      return colors.warning;
    case 'error':
      return colors.error;
    case 'info':
      return colors.info;
    case 'inverse':
      return colors.textInverse;
    case 'disabled':
      return colors.textTertiary;
    case 'primary':
    default:
      return colors.text;
  }
}

const styles = StyleSheet.create({
  numeric: numericText,
  uppercase: { textTransform: 'uppercase' },
});
