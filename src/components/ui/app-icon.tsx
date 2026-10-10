import { SymbolView } from 'expo-symbols';
import { Platform, type StyleProp, type ViewStyle } from 'react-native';

import { appIcons, iconWeights, useAppTheme, type AppIconName, type AppIconWeight } from '@/theme';
import { AndroidMaterialIcon } from './android-material-icon';

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

  if (Platform.OS === 'android') {
    return (
      <AndroidMaterialIcon
        name={appIcons[name].android}
        size={size}
        color={color ?? colors.textSecondary}
        style={style}
      />
    );
  }

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
