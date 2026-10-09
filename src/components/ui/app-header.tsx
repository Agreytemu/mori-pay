import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { gutter, spacing, useAppTheme } from '@/theme';

export type AppHeaderProps = {
  title?: string;
  subtitle?: string;
  /** Leading slot: back button, avatar or logo. */
  left?: ReactNode;
  /** Trailing slot: icon buttons or actions. */
  right?: ReactNode;
  /** `center` centres the text block, for detail screens. */
  align?: 'start' | 'center';
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Sticky screen header.
 *
 * Reused by every route; screens only supply the copy and the action slots.
 */
export function AppHeader({
  title,
  subtitle,
  left,
  right,
  align = 'start',
  bordered = false,
  style,
}: AppHeaderProps) {
  const { colors } = useAppTheme();

  return (
    <View
      style={[
        styles.root,
        {
          paddingHorizontal: align === 'center' ? spacing.lg : gutter,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
        },
        bordered && styles.bordered,
        style,
      ]}>
      {left ? <View style={styles.side}>{left}</View> : null}

      <View style={[styles.titleBlock, align === 'center' && styles.centeredBlock]}>
        {title ? (
          <AppText variant="title" numberOfLines={1}>
            {title}
          </AppText>
        ) : null}
        {subtitle ? (
          <AppText variant="caption" tone="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>

      {right ? <View style={[styles.side, styles.sideRight]}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  bordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  side: {
    flexShrink: 0,
  },
  sideRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginLeft: 'auto',
  },
  titleBlock: {
    flexShrink: 1,
    gap: 2,
    paddingVertical: spacing.xs,
  },
  centeredBlock: {
    flex: 1,
    alignItems: 'center',
  },
});
