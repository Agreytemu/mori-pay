import { SymbolView } from 'expo-symbols';
import { type StyleProp, type ViewStyle } from 'react-native';

import { appIcons, iconWeights, useAppTheme, type AppIconName, type AppIconWeight } from '@/theme';

export type AppIconProps = {
  name: AppIconName;
  size?: number;
  /** Defaults to the theme's neutral icon colour. */
  color?: string;
  weight?: AppIconWeight;
  style?: StyleProp<ViewStyle>;
};

/**
 * Cross-platform icon.
 *
 * Wraps `expo-symbols` so screens depend on a small, app-level icon registry
 * instead of per-platform symbol names.
 */
export function AppIcon({ name, size = 22, color, weight = 'regular', style }: AppIconProps) {
  const { colors } = useAppTheme();

  return (
    <SymbolView
      name={appIcons[name]}
      size={size}
      weight={iconWeights[weight]}
      tintColor={color ?? colors.textSecondary}
      style={style}
    />
  );
}
