import { Text, type TextProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { typography, type TypographyVariant } from '@/theme/typography';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

const textVariants = {
  default: 'themedDefault',
  title: 'themedTitle',
  small: 'themedSmall',
  smallBold: 'themedSmallBold',
  subtitle: 'themedSubtitle',
  link: 'themedLink',
  linkPrimary: 'themedLinkPrimary',
  code: 'themedCode',
} satisfies Record<NonNullable<ThemedTextProps['type']>, TypographyVariant>;

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const colorToken = {
    text: 'text',
    background: 'background',
    backgroundElement: 'surfaceMuted',
    backgroundSelected: 'surfacePressed',
    textSecondary: 'textSecondary',
  } as const;

  return (
    <Text
      style={[
        { color: theme.colors[colorToken[themeColor ?? 'text']] },
        typography[textVariants[type]],
        style,
      ]}
      {...rest}
    />
  );
}
