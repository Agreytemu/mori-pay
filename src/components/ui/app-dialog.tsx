import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { DangerButton, PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { layout, radius, shadows, spacing, useAppTheme } from '@/theme';

export type AppDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  /** Adds a second, styled action button. */
  confirmLabel?: string;
  onConfirm?: () => void;
  confirmDestructive?: boolean;
  dismissLabel?: string;
  testID?: string;
};

/**
 * Cross-platform confirmation / information dialog.
 *
 * Uses `Modal` rather than `Alert` so behaviour is identical on native and web.
 */
export function AppDialog({
  visible,
  title,
  message,
  onClose,
  confirmLabel,
  onConfirm,
  confirmDestructive = false,
  dismissLabel = 'Close',
  testID,
}: AppDialogProps) {
  const { colors } = useAppTheme();
  const hasConfirm = Boolean(confirmLabel && onConfirm);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}> 
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View
          testID={testID}
          style={[
            styles.card,
            shadows.raised,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}>
          <AppText variant="heading" style={styles.centered} numberOfLines={2}>
            {title}
          </AppText>
          <AppText variant="body" tone="secondary" style={styles.centered}>
            {message}
          </AppText>

          <View style={styles.actions}>
            {hasConfirm ? (
              confirmDestructive ? (
                <DangerButton
                  label={confirmLabel as string}
                  onPress={onConfirm}
                  size="md"
                  testID="dialog-confirm"
                />
              ) : (
                <PrimaryButton
                  label={confirmLabel as string}
                  onPress={onConfirm}
                  size="md"
                  testID="dialog-confirm"
                />
              )
            ) : null}

            {hasConfirm ? (
              <SecondaryButton label={dismissLabel} onPress={onClose} testID="dialog-cancel" />
            ) : (
              <PrimaryButton label={dismissLabel} onPress={onClose} size="md" testID="dialog-cancel" />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: layout.maxContentWidth - spacing.huge,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  centered: {
    textAlign: 'center',
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
});
