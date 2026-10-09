import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { gutter, layout, spacing, useAppTheme } from '@/theme';

export type ScreenContainerProps = {
  /** Sticky content pinned under the status bar (usually an `AppHeader`). */
  header?: ReactNode;
  /** Sticky content pinned above the tab bar. */
  footer?: ReactNode;
  children: ReactNode;
  /** Wraps content in a `ScrollView`. Defaults to true. */
  scrollable?: boolean;
  /** Applies the status-bar inset. Disable when a custom header draws it. */
  topInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  testID?: string;
};

/**
 * Screen chrome shared by every route: background colour, safe-area handling,
 * constrained content width on large screens and consistent gutters.
 */
export function ScreenContainer({
  header,
  footer,
  children,
  scrollable = true,
  topInset = true,
  contentStyle,
  keyboardShouldPersistTaps = 'handled',
  testID,
}: ScreenContainerProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const contentPadding: StyleProp<ViewStyle>[] = [
    styles.content,
    // When a header is present it already owns the status-bar inset.
    { paddingTop: header || !topInset ? spacing.lg : insets.top + spacing.lg },
    contentStyle,
  ];

  const body = scrollable ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={contentPadding}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentPadding]}>{children}</View>
  );

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.frame}>
        {header ? (
          <View
            style={[
              styles.headerSlot,
              topInset ? { paddingTop: insets.top } : null,
              { backgroundColor: colors.background },
            ]}>
            {header}
          </View>
        ) : null}

        {body}

        {footer ? <View style={styles.footerSlot}>{footer}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
  },
  frame: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  flex: {
    flex: 1,
  },
  headerSlot: {
    width: '100%',
  },
  footerSlot: {
    width: '100%',
    paddingHorizontal: gutter,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  content: {
    paddingHorizontal: gutter,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
});
