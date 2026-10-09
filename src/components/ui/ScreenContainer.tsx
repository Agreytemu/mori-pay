import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme';

export type ScreenContainerProps = {
  children: ReactNode;
  /** Rendered above the scroll area and pinned to the top. */
  header?: ReactNode;
  /** Extra bottom padding so content clears the tab bar. */
  bottomInset?: number;
  /** Set `false` for screens that manage their own horizontal gutters. */
  padded?: boolean;
  /** Set `false` when the screen hosts its own `FlatList`. */
  scroll?: boolean;
  /** Sticky bar pinned above the tab bar. */
  footer?: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Wraps every screen: themed background, centred content column for
 * tablets/web, safe-area handling and tab-bar clearance at the bottom.
 */
export function ScreenContainer({
  children,
  header,
  bottomInset = 0,
  padded = true,
  scroll = true,
  footer,
  contentContainerStyle,
  testID,
}: ScreenContainerProps) {
  const { colors, space, screenPadding } = useAppTheme();
  const insets = useSafeAreaInsets();

  const gutter = padded ? screenPadding : 0;
  const column = [styles.column, padded ? { paddingHorizontal: gutter } : null];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} testID={testID}>
      {header}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[
              column,
              { paddingTop: space.xxs, paddingBottom: insets.bottom + bottomInset + space.xl },
              contentContainerStyle,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        ) : (
          <View style={styles.flex}>
            <View style={[styles.column, styles.fill, column]}>{children}</View>
          </View>
        )}
      </KeyboardAvoidingView>
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              paddingTop: space.sm,
              paddingBottom: Math.max(insets.bottom, 0) + space.sm,
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}>
          <View style={[styles.column, padded ? { paddingHorizontal: gutter } : null]}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
  },
  flex: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  column: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});