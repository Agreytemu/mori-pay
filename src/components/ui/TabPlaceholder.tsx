import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import type { IconName } from '@/constants/icons';
import { useAppTheme } from '@/theme';

export function TabPlaceholder({
  title,
  icon,
}: {
  title: string;
  icon: IconName;
}) {
  const { colors, space, radius } = useAppTheme();

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { padding: space.base, gap: space.md }]}>
        <AppText variant="title2">{title}</AppText>
        <View
          style={[
            styles.placeholder,
            {
              padding: space.xl,
              borderRadius: radius.xl,
              backgroundColor: colors.surfaceMuted,
              gap: space.md,
            },
          ]}>
          <AppIcon name={icon} size={28} color={colors.primary} />
          <AppText variant="bodySmall" color={colors.textSecondary} align="center">
            {title} will be available here.
          </AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
});
