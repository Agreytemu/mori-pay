import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import type { IconName } from '@/constants/icons';
import { useAppTheme } from '@/theme';
import { typography } from '@/theme/typography';

export type AppHeaderAction = {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  /** Renders a small count bubble, e.g. unread notifications. */
  badge?: number;
};

export type AppHeaderProps = {
  title: string;
  subtitle?: string;
  /** Small line above the title, e.g. the greeting on Home. */
  eyebrow?: string;
  actions?: AppHeaderAction[];
  /** Renders the back chevron on the left. */
  onBack?: () => void;
  /** Centred variant is used on the Payments screen. */
  align?: 'start' | 'center';
  style?: StyleProp<ViewStyle>;
};

/**
 * In-screen app bar. Replaces the platform navigation header so every screen
 * shares one layout: eyebrow → title → subtitle, with icon actions on the right.
 */
export function AppHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  onBack,
  align = 'start',
  style,
}: AppHeaderProps) {
  const { colors, space, radius } = useAppTheme();
  const insets = useSafeAreaInsets();

  const actionNodes = actions?.map((action) => (
    <Pressable
      key={action.accessibilityLabel}
      onPress={action.onPress}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: pressed ? colors.surfacePressed : colors.surface,
          borderColor: colors.border,
          borderRadius: radius.circle,
        },
      ]}>
      <AppIcon name={action.icon} size={19} color={colors.text} weight="medium" />
      {action.badge && action.badge > 0 ? (
        <View
          style={[
            styles.badge,
            { backgroundColor: colors.error, borderColor: colors.background },
          ]}>
          <AppText variant="overline" color={colors.onPrimary} style={styles.badgeText}>
            {action.badge > 9 ? '9+' : String(action.badge)}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  ));

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + space.sm,
          paddingBottom: space.md,
          paddingHorizontal: space.base,
          gap: space.sm,
        },
        style,
      ]}>
      <View
        style={[
          styles.row,
          align === 'center' && styles.rowCentered,
        ]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            style={({ pressed }) => [
              styles.action,
              styles.back,
              {
                backgroundColor: pressed ? colors.surfacePressed : 'transparent',
                borderRadius: radius.circle,
              },
            ]}>
            <AppIcon name="chevronLeft" size={22} color={colors.text} weight="medium" />
          </Pressable>
        ) : null}

        <View style={styles.titleGroup}>
          {eyebrow ? (
            <AppText variant="overline" color={colors.textTertiary} numberOfLines={1}>
              {eyebrow}
            </AppText>
          ) : null}
          <AppText variant="display" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="bodySmall" color={colors.textSecondary} numberOfLines={1}>
              {subtitle}
            </AppText>
          ) : null}
        </View>

        {actionNodes && actionNodes.length > 0 ? (
          <View style={styles.actions}>{actionNodes}</View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    gap: 10,
  },
  rowCentered: {
    justifyContent: 'space-between',
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  action: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  back: {
    borderWidth: 0,
    marginLeft: -8,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    ...typography.badgeLabel,
    letterSpacing: 0,
    color: '#FFFFFF',
  },
});

/** Light/dark aware status bar used by every screen. */
export function AppStatusBar() {
  const { scheme } = useAppTheme();
  return (
    <StatusBar
      style={scheme === 'dark' ? 'light' : 'dark'}
    />
  );
}