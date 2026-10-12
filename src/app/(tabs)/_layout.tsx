import { Tabs, useRouter, useSegments } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { AppIcon } from '@/components/ui/AppIcon';
import { APP } from '@/constants/app';
import { spacing, typography, useAppTheme } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ROUTES = [
  { name: 'index', href: '/(tabs)', label: 'Home', icon: 'home' },
  { name: 'payments', href: '/(tabs)/payments', label: 'Payments', icon: 'payments' },
  { name: 'wallet-tab', href: '/(tabs)/wallet-tab', label: 'Wallet', icon: 'wallet' },
  { name: 'transactions', href: '/(tabs)/transactions', label: 'Transactions', icon: 'transactions' },
  { name: 'profile', href: '/(tabs)/profile', label: 'Profile', icon: 'profile' },
] as const;

export default function TabLayout() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const segments = useSegments();
  const activeTab = segments[1] ?? 'index';

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(segments.length <= 2)
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .runOnJS(true)
        .onEnd(({ translationX, velocityX }) => {
          if (Math.abs(translationX) < 80 && Math.abs(velocityX) < 600) return;

          const currentIndex = ROUTES.findIndex((route) => route.name === activeTab);
          if (currentIndex < 0) return;

          const nextIndex = currentIndex + (translationX < 0 ? 1 : -1);
          const nextRoute = ROUTES[nextIndex];
          if (nextRoute) router.navigate(nextRoute.href);
        }),
    [activeTab, router, segments.length],
  );

  return (
    <GestureDetector gesture={swipeGesture}>
      <View style={styles.container}>
        <Tabs
          screenOptions={{
            headerShown: false,
            animation: 'shift',
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.tabBarInactive,
            tabBarHideOnKeyboard: true,
            tabBarLabelStyle: styles.label,
            tabBarItemStyle: styles.item,
            tabBarStyle: {
              height: 64 + insets.bottom,
              paddingTop: spacing.sm,
              paddingBottom: Math.max(spacing.xs, insets.bottom),
              backgroundColor: colors.tabBarBackground,
              borderTopColor: colors.tabBarBorder,
              borderTopWidth: StyleSheet.hairlineWidth,
            },
            sceneStyle: { backgroundColor: colors.background },
          }}>
          {ROUTES.map(({ name, label, icon }) => (
            <Tabs.Screen
              key={name}
              name={name}
              options={{
                title: label,
                tabBarAccessibilityLabel: `${label} tab for ${APP.name}`,
                tabBarIcon: ({ focused, color }) => (
                  <AppIcon
                    name={icon}
                    size={21}
                    color={focused ? colors.primary : colors.tabBarInactive}
                    weight={focused ? 'semibold' : 'regular'}
                  />
                ),
              }}
            />
          ))}
        </Tabs>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  item: {
    minHeight: 48,
  },
  label: {
    ...typography.tabLabel,
    marginTop: 2,
  },
});