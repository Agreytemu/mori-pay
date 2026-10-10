import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { APP } from '@/constants/app';
import { useAppTheme } from '@/theme';

const logo = require('../../../assets/images/mori pay official logo.png');

export function AuthBrand() {
  const { colors, radius, space } = useAppTheme();

  return (
    <View style={[styles.brand, { gap: space.xs }]}>
      <Image
        source={logo}
        resizeMode="contain"
        accessibilityLabel="Mori Pay logo"
        style={[
          styles.logo,
          { backgroundColor: colors.surface, borderRadius: radius.lg },
        ]}
      />
      <AppText variant="title1">{APP.name}</AppText>
      <AppText variant="bodySmall" color={colors.textSecondary} align="center">
        Move money simply and securely.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: 'center' },
  logo: { width: 112, height: 112 },
});
