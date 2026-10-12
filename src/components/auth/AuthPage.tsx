import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { APP } from '@/constants/app';
import { useAppTheme } from '@/theme';

const heroImages = [
  require('../../../assets/images/authimage.jpg'),
  require('../../../assets/images/auth-hero-shillings.jpg'),
  require('../../../assets/images/auth-hero-cash-stack.jpg'),
  require('../../../assets/images/auth-hero-notes-in-hand.jpg'),
] as const;
const appLogo = require('../../../assets/images/mori pay official logo.png');

export function AuthPage({
  children,
  onBack,
  contentStyle,
}: {
  children: ReactNode;
  onBack?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors, space } = useAppTheme();
  const [heroImageIndex, setHeroImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setHeroImageIndex((index) => (index + 1) % heroImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ImageBackground source={heroImages[heroImageIndex]} resizeMode="cover" style={styles.hero}>
        <View style={styles.heroOverlay} />
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              { backgroundColor: pressed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.16)' },
            ]}>
            <AppIcon name="chevronLeft" size={20} color="#FFFFFF" weight="semibold" />
          </Pressable>
        ) : null}
        <View style={styles.brand}>
          <Image source={appLogo} resizeMode="contain" accessibilityLabel={`${APP.name} logo`} style={styles.logo} />
          <AppText variant="title2" style={styles.brandName}>{APP.name}</AppText>
          <AppText variant="caption" style={styles.brandTagline}>
            Move money simply and securely.
          </AppText>
        </View>
        <View style={styles.pagination} accessibilityElementsHidden>
          {heroImages.map((_, index) => (
            <View
              key={index}
              style={[styles.paginationDot, index === heroImageIndex && styles.activePaginationDot]}
            />
          ))}
        </View>
      </ImageBackground>

      <KeyboardAvoidingView
        style={styles.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[
            styles.formCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              padding: space.lg,
              gap: space.lg,
            },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  hero: {
    height: 260,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(5, 22, 52, 0.54)',
  },
  backButton: {
    position: 'absolute',
    top: 14,
    left: 20,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 14,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    marginBottom: 4,
  },
  brandName: { color: '#FFFFFF' },
  brandTagline: { color: 'rgba(255,255,255,0.8)' },
  pagination: {
    position: 'absolute',
    bottom: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  paginationDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.58)',
  },
  activePaginationDot: {
    width: 16,
    backgroundColor: '#FFFFFF',
  },
  keyboardArea: {
    flex: 1,
    marginTop: -28,
  },
  formCard: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingTop: 28,
    paddingBottom: 32,
  },
});
