import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppIllustration } from '@/components/ui/AppIllustration';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/button';
import { APP } from '@/constants/app';
import { useAppTheme } from '@/theme';

const slides = [
  {
    eyebrow: 'MONEY, MADE SIMPLE',
    title: 'Move money without the hassle.',
    description: 'Send and receive money in just a few simple steps, wherever you are.',
    illustration: 'transfer',
  },
  {
    eyebrow: 'YOUR MONEY, IN CONTROL',
    title: 'Your money. One clear view.',
    description: 'See your balance and transactions clearly, whenever you need them.',
    illustration: 'wallet',
  },
  {
    eyebrow: 'PAY WITH CONFIDENCE',
    title: 'Pay quickly. Stay secure.',
    description: 'Scan a QR code to pay with ease and protect your account with a PIN.',
    illustration: 'secure',
  },
] as const;

type OnboardingScreenProps = {
  onComplete: () => Promise<void>;
};

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const { colors, radius, space } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [saving, setSaving] = useState(false);
  const illustrationWidth = Math.min(width - space.xl * 2, 420);
  const illustrationHeight = Math.min(
    illustrationWidth * 0.78,
    320,
    Math.max(96, height - insets.top - insets.bottom - 430),
  );

  const moveToSlide = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setActiveSlide(index);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setActiveSlide(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  const finish = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onComplete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: Math.max(insets.top, space.base), paddingHorizontal: space.xl },
        ]}>
        <View style={styles.brand}>
          <View style={[styles.brandMark, { backgroundColor: colors.primary, borderRadius: radius.md }]}>
            <AppIcon name="wallet" size={21} color={colors.onPrimary} weight="semibold" />
          </View>
          <AppText variant="bodySmallStrong">{APP.name}</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip introduction"
          hitSlop={12}
          disabled={saving}
          onPress={() => void finish()}
          style={({ pressed }) => [styles.skip, { opacity: pressed || saving ? 0.6 : 1 }]}>
          <AppText variant="bodySmallStrong" color={colors.textSecondary}>Skip</AppText>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        style={styles.carousel}
        accessibilityLabel="Mori Pay introduction">
        {slides.map((item, index) => (
          <View key={item.eyebrow} style={[styles.slide, { width }]}>
            <View
              style={[
                styles.illustrationFrame,
                {
                  width: illustrationWidth,
                  height: illustrationHeight,
                  borderRadius: radius.xxl,
                  backgroundColor: colors.surfaceMuted,
                },
              ]}>
              <OnboardingIllustration
                kind={item.illustration}
                width={illustrationWidth}
                height={illustrationHeight}
              />
            </View>
            <View style={[styles.copy, { paddingHorizontal: space.xl }]}>
              <AppText variant="caption" color={colors.primary} style={styles.eyebrow}>
                {item.eyebrow}
              </AppText>
              <AppText variant="title1" align="center" style={styles.title}>
                {item.title}
              </AppText>
              <AppText variant="body" color={colors.textSecondary} align="center" style={styles.description}>
                {item.description}
              </AppText>
            </View>
            <View style={styles.pagination} accessibilityLabel={`Page ${index + 1} of ${slides.length}`}>
              {slides.map((page, pageIndex) => (
                <Pressable
                  key={page.eyebrow}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to page ${pageIndex + 1}`}
                  accessibilityState={{ selected: activeSlide === pageIndex }}
                  onPress={() => moveToSlide(pageIndex)}
                  hitSlop={8}
                  style={[
                    styles.paginationDot,
                    {
                      width: activeSlide === pageIndex ? 24 : 7,
                      backgroundColor:
                        activeSlide === pageIndex ? colors.primary : colors.borderStrong,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: space.xl,
            paddingBottom: Math.max(insets.bottom, space.base),
          },
        ]}>
        <PrimaryButton
          block
          size="lg"
          loading={saving}
          label={activeSlide === slides.length - 1 ? 'Get started' : 'Continue'}
          icon={activeSlide === slides.length - 1 ? 'check' : 'chevronRight'}
          iconPosition="trailing"
          onPress={() => {
            if (activeSlide === slides.length - 1) {
              void finish();
            } else {
              moveToSlide(activeSlide + 1);
            }
          }}
        />
        <AppText variant="caption" color={colors.textTertiary} align="center" style={styles.footerNote}>
          Your money, made simple and secure.
        </AppText>
      </View>
    </View>
  );
}

function OnboardingIllustration({
  kind,
  width,
  height,
}: {
  kind: (typeof slides)[number]['illustration'];
  width: number;
  height: number;
}) {
  const { colors, radius } = useAppTheme();
  const illustration =
    kind === 'transfer' ? 'sendMoney' : kind === 'wallet' ? 'wallet' : 'qrScan';
  const badge =
    kind === 'transfer'
      ? { icon: 'check' as const, label: 'Just sent', color: colors.success }
      : kind === 'wallet'
        ? { icon: 'wallet' as const, label: 'Live balance', color: colors.primary }
        : { icon: 'security' as const, label: 'Protected', color: colors.info };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        kind === 'transfer'
          ? 'Illustration of sending money from a phone'
          : kind === 'wallet'
            ? 'Illustration of a wallet and balance overview'
            : 'Illustration of a QR code and account security'
      }
      style={{ width, height }}>
      <View
        style={[
          styles.illustrationAura,
          { backgroundColor: colors.primarySoft, borderRadius: radius.xxl },
        ]}
      />
      <Svg width={width} height={height} viewBox="0 0 360 280" style={styles.illustrationDetails}>
        <Path
          d="M48 178c8-52 35-103 82-119m104 9c39 18 67 55 77 98"
          fill="none"
          stroke={colors.borderStrong}
          strokeDasharray="3 9"
          strokeLinecap="round"
          strokeWidth="2"
          opacity="0.75"
        />
        <Circle cx="65" cy="76" r="20" fill={colors.warningSoft} />
        <Circle cx="295" cy="197" r="22" fill={colors.infoSoft} />
        <Path
          d="m285 38 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8ZM67 205l2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z"
          fill={colors.success}
          opacity="0.9"
        />
        <Circle cx="311" cy="91" r="4" fill={colors.warning} />
        <Circle cx="45" cy="137" r="3" fill={colors.primary} />
      </Svg>
      <View style={styles.heroIllustration}>
        <AppIllustration name={illustration} width={width * 0.96} height={height * 0.95} />
      </View>
      <View
        style={[
          styles.illustrationBadge,
          {
            top: height * 0.1,
            right: width * 0.035,
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderRadius: radius.xl,
          },
        ]}>
        <View
          style={[
            styles.badgeIcon,
            { backgroundColor: kind === 'transfer' ? colors.successSoft : colors.primarySoft },
          ]}>
          <AppIcon name={badge.icon} size={15} color={badge.color} weight="semibold" />
        </View>
        <AppText variant="bodySmallStrong" color={colors.text}>
          {badge.label}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  carousel: { flex: 1 },
  slide: { alignItems: 'center', justifyContent: 'center', paddingTop: 8, paddingBottom: 4 },
  illustrationFrame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  illustrationAura: { ...StyleSheet.absoluteFill, margin: 20, opacity: 0.8 },
  illustrationDetails: { ...StyleSheet.absoluteFill },
  heroIllustration: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  illustrationBadge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 9,
  },
  badgeIcon: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { width: '100%', alignItems: 'center', marginTop: 26, gap: 10, maxWidth: 520 },
  eyebrow: { fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { width: '100%', maxWidth: 440, flexShrink: 1 },
  description: { width: '100%', maxWidth: 380, lineHeight: 24, flexShrink: 1 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 25 },
  paginationDot: { height: 7, borderRadius: 99 },
  footer: { gap: 12, paddingTop: 12 },
  footerNote: { marginTop: 0 },
});
