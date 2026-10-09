import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { APP } from '@/constants/app';
import { spacing, useAppTheme } from '@/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ROUTES = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'payments', label: 'Payments', icon: 'payments' },
  { name: 'wallet-tab', label: 'Wallet', icon: 'wallet' },
  { name: 'transactions', label: 'Transactions', icon: 'transactions' },
  { name: 'profile', label: 'Profile', icon: 'profile' },
] as const;

export default function TabLayout() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
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
  );
}

const styles = StyleSheet.create({
  item: {
    minHeight: 48,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
});