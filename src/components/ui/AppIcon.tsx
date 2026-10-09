import { createElement } from 'react';
import { SymbolView } from 'expo-symbols';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { ICONS, type IconName } from '@/constants/icons';
import { useAppTheme } from '@/theme';

export type AppIconWeight = 'regular' | 'medium' | 'semibold';

const WEIGHTS = {
  regular: { ios: 'regular', android: { name: 'MaterialSymbols_400Regular', font: 0 } },
  medium: { ios: 'medium', android: { name: 'MaterialSymbols_500Medium', font: 0 } },
  semibold: { ios: 'semibold', android: { name: 'MaterialSymbols_600SemiBold', font: 0 } },
} as const;

const WEB_PATHS: Partial<Record<IconName, string[]>> = {
  home: ['M3 10.5 12 3l9 7.5', 'M5.5 9v11h13V9', 'M9.5 20v-6h5v6'],
  homeOutline: ['M3 10.5 12 3l9 7.5', 'M5.5 9v11h13V9'],
  payments: ['M3 6.5h18a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 17V8A1.5 1.5 0 0 1 3 6.5Z', 'M2 10h20', 'M6 15h4'],
  paymentsOutline: ['M3 6.5h18a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 17V8A1.5 1.5 0 0 1 3 6.5Z', 'M2 10h20'],
  transactions: ['M6 4h12v17H6z', 'M9 8h6', 'M9 12h6', 'M9 16h4'],
  transactionsOutline: ['M6 4h12v17H6z', 'M9 8h6', 'M9 12h6', 'M9 16h4'],
  profile: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 21c.5-4.2 3.3-6.5 8-6.5s7.5 2.3 8 6.5'],
  profileOutline: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 21c.5-4.2 3.3-6.5 8-6.5s7.5 2.3 8 6.5'],
  send: ['M5 19 19 5', 'M8 5h11v11'],
  receive: ['M19 5 5 19', 'M16 19H5V8'],
  pay: ['M3 10h18l-2-6H5l-2 6Z', 'M5 10v10h14V10', 'M9 20v-6h6v6', 'M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0'],
  request: ['M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M5 21c0-4 2.5-6 7-6s7 2 7 6', 'M19 3v6', 'M16 6h6'],
  copy: ['M8 8V4h12v12h-4', 'M4 8h12v12H4z'],
  deposit: ['M12 3v13', 'm7 11 5 5 5-5', 'M5 21h14'],
  withdraw: ['M12 21V8', 'm7 13 5-5 5 5', 'M5 3h14'],
  phone: ['M6.6 3h3l1.5 4.5-2 1.5a15 15 0 0 0 5.9 5.9l1.5-2 4.5 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.2 2 2 0 0 1 6.6 3Z'],
  check: ['m5 12 4 4L19 6'],
  wallet: ['M3 6.5h17a1.5 1.5 0 0 1 1.5 1.5v11H3a1.5 1.5 0 0 1-1.5-1.5V8A1.5 1.5 0 0 1 3 6.5Z', 'M2 9V6a2 2 0 0 1 2-2h14', 'M16 13h5'],
  transfer: ['M4 8h15', 'm15 4 4 4-4 4', 'M20 16H5', 'm9 12-4 4 4 4'],
  notification: ['M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
  notificationOutline: ['M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
  notificationActive: ['M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4', 'M19 3v3', 'M17.5 4.5h3'],
  chevronRight: ['m9 18 6-6-6-6'],
  chevronLeft: ['m15 18-6-6 6-6'],
  chevronDown: ['m6 9 6 6 6-6'],
  close: ['m6 6 12 12', 'M18 6 6 18'],
  eye: ['M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  eyeOff: ['m3 3 18 18', 'M10.6 6.2A10.5 10.5 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3.2 3.8', 'M6.2 6.2C3.5 8 2 12 2 12s3.5 6 10 6c1.4 0 2.7-.3 3.8-.8'],
  security: ['M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z', 'm9 12 2 2 4-4'],
  success: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'm8 12 2.5 2.5L16.5 9'],
  pending: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 6v6l4 2'],
  failed: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'm9 9 6 6', 'm15 9-6 6'],
  warning: ['m12 3 10 18H2L12 3Z', 'M12 9v5', 'M12 17h.01'],
  emptyInbox: ['M3 4h18v16H3z', 'M3 13h5l2 3h4l2-3h5'],
  receipt: ['M6 3h12v18l-3-2-3 2-3-2-3 2V3Z', 'M9 8h6', 'M9 12h6'],
  qrCode: ['M3 3h6v6H3z', 'M15 3h6v6h-6z', 'M3 15h6v6H3z', 'M15 15h3v3h-3z', 'M21 15v6', 'M15 21h3'],
};

export type AppIconProps = {
  name: IconName;
  size?: number;
  color?: string;
  weight?: AppIconWeight;
  style?: ViewStyle;
  /** Decorative by default so screen readers announce the surrounding label only. */
  decorative?: boolean;
};

/**
 * Renders a semantic icon name across iOS (SF Symbols), Android and web.
 */
export function AppIcon({
  name,
  size = 22,
  color,
  weight = 'regular',
  style,
  decorative = true,
}: AppIconProps) {
  const { colors } = useAppTheme();
  const icon = ICONS[name];

  if (Platform.OS === 'web') {
    const paths = WEB_PATHS[name] ?? ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z'];
    const svg = createElement(
      'svg',
      {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: color ?? colors.text,
        strokeWidth: weight === 'regular' ? 1.8 : 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': decorative,
        focusable: false,
      },
      ...paths.map((path, index) => createElement('path', { key: index, d: path }))
    );

    return (
      <View
        style={[styles.webIcon, { width: size, height: size }, style]}
        accessibilityElementsHidden={decorative}
        importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
        accessibilityRole={decorative ? 'none' : 'image'}>
        {svg}
      </View>
    );
  }

  return (
    <SymbolView
      name={{ ios: icon.ios, android: icon.android, web: icon.android }}
      size={size}
      tintColor={color ?? colors.text}
      weight={WEIGHTS[weight]}
      style={style}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      accessibilityRole={decorative ? 'none' : 'image'}
    />
  );
}

const styles = StyleSheet.create({
  webIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});