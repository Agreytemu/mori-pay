import { useCallback, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { AppDialog } from '@/components/ui/app-dialog';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/button';
import {
  clearAllNotifications,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
  reloadNotifications,
  useNotifications,
} from '@/data/notification-store';
import type { AppNotification } from '@/data/mock-notifications';
import { useAppTheme } from '@/theme';
import { formatMoney } from '@/utils/format-money';
import { NotificationEmptyState, NotificationIcon } from '@/components/notifications/notification-components';

function Header({ title, subtitle, onBack, right }: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  right?: ReactNode;
}) {
  const { colors, radius } = useAppTheme();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        style={({ pressed }) => [
          styles.headerButton,
          { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border, borderRadius: radius.circle },
        ]}>
        <AppIcon name="chevronLeft" size={19} color={colors.text} />
      </Pressable>
      <View style={styles.headerText}>
        <AppText variant="title2">{title}</AppText>
        {subtitle ? <AppText variant="caption" color={colors.textSecondary}>{subtitle}</AppText> : null}
      </View>
      {right ?? <View style={styles.headerButton} />}
    </View>
  );
}

export function NotificationsScreen() {
  const router = useRouter();
  const { notifications, loading, error } = useNotifications();
  const { colors, space } = useAppTheme();
  const [confirmClear, setConfirmClear] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void reloadNotifications();
    }, []),
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationPress = async (notification: AppNotification) => {
    try {
      await markNotificationRead(notification.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not mark notification as read.');
      return;
    }
    if (notification.transactionId) {
      router.push({
        pathname: '/transaction/[id]',
        params: { id: notification.transactionId },
      });
    } else {
      router.push({ pathname: '/notifications/[id]', params: { id: notification.id } });
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { padding: space.base, gap: space.lg }]}
        showsVerticalScrollIndicator={false}>
        <Header
          title="Notifications"
          subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          onBack={() => router.back()}
          right={
            notifications.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mark all as read"
                onPress={() => {
                  void markAllNotificationsRead().catch((error: unknown) =>
                    setActionError(error instanceof Error ? error.message : 'Could not mark notifications as read.')
                  );
                }}
                style={({ pressed }) => [
                  styles.headerButton,
                  { backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border, borderRadius: 999 },
                ]}>
                <AppText variant="caption" color={colors.primary}>Mark all read</AppText>
              </Pressable>
            ) : undefined
          }
        />

        {error || actionError ? (
          <Pressable onPress={() => {
            setActionError(null);
            void reloadNotifications();
          }}>
            <AppText variant="bodySmall" color={colors.error}>
              {actionError ?? error?.message} Tap to retry.
            </AppText>
          </Pressable>
        ) : null}

        {loading ? (
          <AppText variant="bodySmall" color={colors.textSecondary}>Loading notifications…</AppText>
        ) : notifications.length > 0 ? (
          <>
            <View style={styles.notificationList}>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onPress={() => handleNotificationPress(notification)}
                  onDelete={() => {
                    void deleteNotification(notification.id).catch((error: unknown) =>
                      setActionError(error instanceof Error ? error.message : 'Could not delete notification.')
                    );
                  }}
                />
              ))}
            </View>
            <Button
              label="Clear all notifications"
              icon="close"
              variant="danger"
              onPress={() => setConfirmClear(true)}
            />
          </>
        ) : (
          <NotificationEmptyState />
        )}
      </ScrollView>

      <AppDialog
        visible={confirmClear}
        title="Clear all notifications?"
        message="This will remove all notifications from your device. This action cannot be undone."
        onClose={() => setConfirmClear(false)}
        confirmLabel="Clear all"
        confirmDestructive
        dismissLabel="Cancel"
        onConfirm={() => {
          void clearAllNotifications()
            .then(() => setConfirmClear(false))
            .catch((error: unknown) =>
              setActionError(error instanceof Error ? error.message : 'Could not clear notifications.')
            );
        }}
      />
    </SafeAreaView>
  );
}

export function NotificationDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { notifications, loading, error } = useNotifications();
  const notification = notifications.find((n) => n.id === params.id);
  const { colors, space } = useAppTheme();
  const [actionError, setActionError] = useState<string | null>(null);

  if (!notification && loading) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.content, { padding: space.base, gap: space.lg }]}>
          <Header title="Notification" onBack={() => router.back()} />
          <AppText variant="bodySmall" color={colors.textSecondary}>Loading notification…</AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (!notification) {
    return (
      <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={[styles.content, { padding: space.base, gap: space.lg }]}>
          <Header title="Notification" onBack={() => router.back()} />
          {error ? <AppText variant="bodySmall" color={colors.error}>{error.message}</AppText> : null}
          <AppText variant="body" color={colors.textSecondary}>This notification is no longer available.</AppText>
          <Button label="Back to notifications" onPress={() => router.replace('/notifications')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { padding: space.base, gap: space.lg }]} showsVerticalScrollIndicator={false}>
        <Header title="Notification" subtitle="Details" onBack={() => router.back()} />
        {actionError ? <AppText variant="bodySmall" color={colors.error}>{actionError}</AppText> : null}

        <View style={[styles.detailHero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <NotificationIcon type={notification.type} status={notification.status} />
          <AppText variant="title3" align="center">{notification.title}</AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} align="center">
            {notification.timestamp}
          </AppText>
        </View>

        <View style={[styles.detailList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <DetailRow label="Message" value={notification.message} />
          {notification.amount ? (
            <DetailRow label="Amount" value={formatMoney(notification.amount, 'TZS')} />
          ) : null}
          {notification.recipient ? (
            <DetailRow label="Recipient" value={notification.recipient} />
          ) : null}
          {notification.reference ? (
            <DetailRow label="Reference" value={notification.reference} />
          ) : null}
          <DetailRow label="Status" value={notification.read ? 'Read' : 'Unread'} last />
        </View>

        {notification.actionRoute ? (
          <Button
            label="View Details"
            icon="chevronRight"
            onPress={() => router.push(notification.actionRoute as any)}
          />
        ) : null}

        <Button
          label="Delete notification"
          icon="close"
          variant="danger"
          onPress={() => {
            void deleteNotification(notification.id)
              .then(() => router.replace('/notifications'))
              .catch((error: unknown) =>
                setActionError(error instanceof Error ? error.message : 'Could not delete notification.')
              );
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function NotificationItem({
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

function DetailRow({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.detailRow, !last && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
      <AppText variant="bodySmall" color={colors.textSecondary}>{label}</AppText>
      <AppText variant="bodySmallStrong" align="right" style={styles.detailValue}>{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingBottom: 30 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerButton: { minWidth: 42, height: 42, paddingHorizontal: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 1 },
  notificationList: { gap: 10 },
  item: { borderWidth: 1, gap: 12 },
  itemContent: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  itemCopy: { flex: 1, gap: 4 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4FBE7E' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  deleteButton: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  detailHero: { borderWidth: 1, borderRadius: 20, padding: 24, alignItems: 'center', gap: 10 },
  detailList: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14 },
  detailRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  detailValue: { flex: 1 },
});
