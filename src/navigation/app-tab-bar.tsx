import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/app-icon';
import { AppText } from '@/components/ui/app-text';
import { APP_TABS_BY_NAME, type AppTabName } from '@/navigation/tab-meta';
import { hitTarget, radius, spacing, typography, useAppTheme } from '@/theme';

const ICON_TILE_WIDTH = 44;
const ICON_TILE_HEIGHT = 28;

type TabRoute = {
  key: string;
  name: string;
};

type TabState = {
  index: number;
  routes: TabRoute[];
};

type TabDescriptor = {
  options?: {
    tabBarLabel?: string;
    title?: string;
    tabBarAccessibilityLabel?: string;
  };
};

type TabNavigation = {
  emit: (event: { type: string; target: string; canPreventDefault?: boolean }) => { defaultPrevented: boolean };
  navigate: (name: string) => void;
};

type BottomTabBarProps = {
  state: TabState;
  descriptors: Record<string, TabDescriptor>;
  navigation: TabNavigation;
  insets: { bottom: number };
};

export function AppTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors } = useAppTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.root,
        {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}>
      {state.routes.map((route, index) => {
        const tab = APP_TABS_BY_NAME[route.name as AppTabName];
        const options = descriptors[route.key]?.options;
        const label = options?.tabBarLabel ?? options?.title ?? tab?.label ?? route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isFocused }}
            accessibilityLabel={options?.tabBarAccessibilityLabel ?? label}
            onPress={onPress}
            onLongPress={onLongPress}
            testID={`tab-${route.name}`}
            style={styles.item}>
            <View
              style={[
                styles.iconTile,
                isFocused && { backgroundColor: colors.primarySoft },
              ]}>
              <AppIcon
                name={tab?.icon ?? 'home'}
                size={21}
                weight={isFocused ? 'semibold' : 'regular'}
                color={isFocused ? colors.primary : colors.tabBarInactive}
              />
            </View>

            <AppText
              variant="tabLabel"
              numberOfLines={1}
              tone={isFocused ? 'brand' : 'muted'}
              style={[styles.label, isFocused && styles.labelActive]}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 3,
    minHeight: hitTarget.min,
    paddingTop: 2,
  },
  iconTile: {
    width: ICON_TILE_WIDTH,
    height: ICON_TILE_HEIGHT,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    letterSpacing: -0.1,
  },
  labelActive: typography.tabLabelActive,
});
