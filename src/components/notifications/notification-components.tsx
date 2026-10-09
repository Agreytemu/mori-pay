import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import type { IconName } from '@/constants/icons';
import type { AppNotification, NotificationStatus, NotificationType } from '@/data/mock-notifications';
import { useAppTheme } from '@/theme';
import { formatMoney } from '@/utils/format-money';

const TYPE_ICONS: Record<NotificationType, IconName> = {
  payment: 'payments',
  transaction: 'transactions',
  security: 'security',
  account: 'profile',
};

const STATUS_COLORS: Record<NotificationStatus, { color: string; background: string }> = {
  success: { color: '#4FBE7E', background: 'rgba(30, 142, 78, 0.16)' },
  failed: { color: '#F0756A', background: 'rgba(196, 52, 42, 0.18)' },
  pending: { color: '#E0A94B', background: 'rgba(194, 118, 12, 0.18)' },
  info: { color: '#7C9CF5', background: 'rgba(43, 95, 217, 0.18)' },
  warning: { color: '#E0A94B', background: 'rgba(194, 118, 12, 0.18)' },
};

export function NotificationIcon({ type, status }: { type: NotificationType; status: NotificationStatus }) {
  const { radius } = useAppTheme();
  const palette = STATUS_COLORS[status];

  return (
    <View
      style={[
        styles.iconContainer,
        { backgroundColor: palette.background, borderRadius: radius.md },
      ]}>
      <AppIcon name={TYPE_ICONS[type]} size={20} color={palette.color} />
    </View>
  );
}

export function NotificationBadge({ count }: { count: number }) {
  const { colors, radius } = useAppTheme();

  if (count === 0) return null;

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: colors.error, borderRadius: radius.circle },
      ]}>
      <AppText variant="caption" color="#FFFFFF">
        {count > 99 ? '99+' : count}
      </AppText>
    </View>
  );
}

export function NotificationItem({
  notification,
  onPress,
  onDelete,
}: {
  notification: AppNotification;
  onPress: () => void;
  onDelete: () => void;
}) {
  const { colors, radius, space } = useAppTheme();
  const isUnread = !notification.read;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${notification.title}. ${notification.message}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        {
          backgroundColor: pressed
            ? colors.surfacePressed
            : isUnread
              ? colors.surface
              : colors.surfaceMuted,
          borderColor: isUnread ? colors.primarySoft : colors.border,
          borderRadius: radius.lg,
          padding: space.base,
        },
      ]}>
      <View style={styles.itemContent}>
        <NotificationIcon type={notification.type} status={notification.status} />
        <View style={styles.itemCopy}>
          <View style={styles.itemTitleRow}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {notification.title}
            </AppText>
            {isUnread ? <View style={styles.unreadDot} /> : null}
          </View>
          <AppText variant="bodySmall" color={colors.textSecondary} numberOfLines={2}>
            {notification.message}
          </AppText>
          <View style={styles.itemMeta}>
            <AppText variant="caption" color={colors.textTertiary}>
              {notification.timestamp}
            </AppText>
            {notification.amount ? (
              <AppText variant="caption" color={colors.textTertiary}>
                · {formatMoney(notification.amount, 'TZS')}
              </AppText>
            ) : null}
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete notification"
          onPress={onDelete}
          hitSlop={8}
          style={({ pressed }) => [
            styles.deleteButton,
            { backgroundColor: pressed ? colors.surfacePressed : 'transparent' },
          ]}>
          <AppIcon name="close" size={16} color={colors.textTertiary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export function NotificationEmptyState() {
  const { colors, space } = useAppTheme();

  return (
    <View style={[styles.emptyState, { padding: space.xl }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
        <AppIcon name="notificationOutline" size={32} color={colors.textTertiary} />
      </View>
      <AppText variant="title3" align="center">
        No notifications
      </AppText>
      <AppText variant="bodySmall" color={colors.textSecondary} align="center">
        You&apos;re all caught up. New notifications will appear here.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  item: {
    borderWidth: 1,
    gap: 12,
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemCopy: {
    flex: 1,
    gap: 4,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4FBE7E',
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: 12,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
});
