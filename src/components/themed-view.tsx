import { View, type ViewProps } from 'react-native';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const { colors, scheme } = useTheme();
  const colorToken = {
    text: 'text',
    background: 'background',
    backgroundElement: 'surfaceMuted',
    backgroundSelected: 'surfacePressed',
    textSecondary: 'textSecondary',
  } as const;
  const backgroundColor =
    (scheme === 'dark' ? darkColor : lightColor) ??
    colors[colorToken[type ?? 'background']];

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
