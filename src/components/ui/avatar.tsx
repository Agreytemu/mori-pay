import { StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import type { IconName } from '@/constants/icons';
import { useAppTheme } from '@/theme';
import { initialsOf } from '@/utils/format';

export type AvatarProps = {
  name: string;
  size?: number;
  icon?: IconName;
  shape?: 'circle' | 'rounded';
};

export function Avatar({ name, size = 44, icon, shape = 'circle' }: AvatarProps) {
  const { colors, radius } = useAppTheme();

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: shape === 'circle' ? radius.circle : radius.md,
          backgroundColor: colors.primarySoft,
        },
      ]}>
      {icon ? (
        <AppIcon name={icon} size={Math.round(size * 0.5)} color={colors.primary} weight="medium" />
      ) : (
        <AppText
          variant="bodySmallStrong"
          color={colors.primary}
          style={{ fontSize: Math.round(size * 0.34), lineHeight: Math.round(size * 0.42) }}>
          {initialsOf(name)}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
