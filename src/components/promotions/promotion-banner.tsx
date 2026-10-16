import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import type { PromotionPlacement } from '@mori-pay/contracts';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { getActivePromotion } from '@/lib/mori-api';
import { useSession } from '@/lib/session';
import { useAsync } from '@/lib/use-async';
import { useAppTheme } from '@/theme';

export type PromotionBannerProps = {
  /** Which promotion slot this banner fills (e.g. `home_banner`). */
  placement: PromotionPlacement;
  /** Whether card actions press into the banner. */
  onPress?: () => void;
};

/**
 * Promotional banner driven by admin-configured promotions. Renders the newest
 * active promotion for the given placement and stays out of the way (renders
 * nothing) when there is none, so screens can drop it in unconditionally.
 */
export function PromotionBanner({ placement, onPress }: PromotionBannerProps) {
  const { colors, space, radius } = useAppTheme();
  const { user } = useSession();
  const [dismissed, setDismissed] = useState(false);

  const promotion = useAsync(() => getActivePromotion(placement), [placement], {
    enabled: user !== null && !dismissed,
  });

  const item = promotion.data;
  if (dismissed || !item) return null;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={item.title}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: colors.primarySoft,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: space.base,
          gap: space.md,
        },
        pressed && onPress ? styles.pressed : null,
      ]}>
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          style={[styles.image, { borderRadius: radius.md }]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View
          style={[
            styles.iconTile,
            { backgroundColor: colors.surface, borderRadius: radius.md },
          ]}>
          <AppIcon name="about" size={20} color={colors.primary} />
        </View>
      )}

      <View style={styles.copy}>
        <AppText variant="bodySmallStrong" color={colors.text} numberOfLines={2}>
          {item.title}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary} numberOfLines={3}>
          {item.body}
        </AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss promotion"
        hitSlop={8}
        onPress={() => setDismissed(true)}
        style={({ pressed }) => [styles.dismiss, pressed ? styles.pressed : null]}>
        <AppIcon name="close" size={16} color={colors.textTertiary} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  image: {
    width: 56,
    height: 56,
  },
  iconTile: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  dismiss: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.72,
  },
});
