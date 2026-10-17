import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { PinBoxes, StatusBanner } from '@/components/profile/profile-components';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { SecondaryButton } from '@/components/ui/button';
import { authenticateWithBiometrics, getBiometricCapability } from '@/lib/biometrics';
import { verifyPin } from '@/lib/mori-api';
import { useSession } from '@/lib/session';
import { radius, spacing, useAppTheme } from '@/theme';

export function AppLockPrompt() {
  const { isAppLocked } = useSession();
  return isAppLocked ? <AppLockModal /> : null;
}

function AppLockModal() {
  const { colors } = useAppTheme();
  const { unlockApp, signOut, pin, biometricUnlockEnabled, biometricUnlockReady } = useSession();
  const router = useRouter();
  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const authenticate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const capability = await getBiometricCapability();
      if (!capability.canAuthenticate) {
        setError(
          capability.unavailableReason ??
            'Biometric authentication is not available. Unlock with your Mori Pay PIN.',
        );
        return;
      }

      const outcome = await authenticateWithBiometrics({
        promptMessage: 'Unlock Mori Pay',
        promptDescription: 'Confirm it is you to continue.',
        cancelLabel: 'Cancel',
      });
      if (outcome.ok) {
        setEntry('');
        unlockApp();
        return;
      }
      if (outcome.message) setError(outcome.message);
    } finally {
      setBusy(false);
    }
  }, [unlockApp]);

  const onPinChange = async (next: string) => {
    if (busy || !pin?.pinSet) return;
    setEntry(next);
    setError(null);
    if (next.length !== 6) return;

    setBusy(true);
    try {
      await verifyPin({ pin: next });
      setEntry('');
      unlockApp();
    } catch (pinError) {
      setEntry('');
      setError(pinError instanceof Error ? pinError.message : 'Incorrect PIN. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const signInWithPassword = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      Keyboard.dismiss();
      router.replace('/(auth)/sign-in');
    } catch (signOutError) {
      setError(
        signOutError instanceof Error
          ? signOutError.message
          : 'Could not open password sign-in. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => {}}
      statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[styles.screen, { backgroundColor: colors.background }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <View style={[styles.lockIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.xl }]}>
            <AppIcon name="security" size={30} color={colors.primary} weight="semibold" />
          </View>
          <AppText variant="title1" align="center">
            Mori Pay is locked
          </AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} align="center">
            Enter your six-digit Mori Pay PIN to continue.
          </AppText>

          {error ? (
            <StatusBanner tone="error" title="Could not unlock" message={error} />
          ) : null}

          {pin?.pinSet ? (
            <PinBoxes
              value={entry}
              onChangeText={(value) => void onPinChange(value)}
              autoFocus
              editable={!busy}
            />
          ) : (
            <StatusBanner
              tone="error"
              title="PIN unavailable"
              message="This app lock needs a Mori Pay PIN when biometric unlock is unavailable."
            />
          )}
          {biometricUnlockReady && biometricUnlockEnabled ? (
            <SecondaryButton
              label="Use biometrics"
              block
              disabled={busy}
              loading={busy}
              onPress={() => void authenticate()}
            />
          ) : null}
          <SecondaryButton
            label="Sign in with password"
            block
            disabled={busy}
            onPress={() => void signInWithPassword()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  lockIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
