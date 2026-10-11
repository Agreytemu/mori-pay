import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

import { PinBoxes, PinKeypad, StatusBanner } from '@/components/profile/profile-components';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { verifyPin } from '@/lib/mori-api';
import { useSession } from '@/lib/session';
import { radius, spacing, useAppTheme } from '@/theme';

export function AppLockPrompt() {
  const { isAppLocked } = useSession();
  return isAppLocked ? <AppLockModal /> : null;
}

function AppLockModal() {
  const { colors } = useAppTheme();
  const { unlockApp, pin } = useSession();
  const [pinMode, setPinMode] = useState(Platform.OS === 'web');
  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const attempted = useRef(false);

  const authenticate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const enrolledLevel = await LocalAuthentication.getEnrolledLevelAsync();
      const canUseDeviceAuthentication =
        Platform.OS === 'ios'
          ? enrolledLevel !== LocalAuthentication.SecurityLevel.NONE
          : enrolledLevel >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;
      if (!canUseDeviceAuthentication) {
        setPinMode(true);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Mori Pay',
        promptDescription: 'Confirm it is you to continue.',
        cancelLabel: 'Use Mori Pay PIN',
        fallbackLabel: 'Use device passcode',
      });
      if (result.success) {
        setEntry('');
        unlockApp();
        return;
      }

      setPinMode(true);
      if (!['user_cancel', 'user_fallback', 'system_cancel'].includes(result.error ?? '')) {
        setError('Device authentication did not succeed. Unlock with your Mori Pay PIN.');
      }
    } catch (authError) {
      setPinMode(true);
      setError(
        authError instanceof Error
          ? authError.message
          : 'Could not start biometric authentication. Unlock with your Mori Pay PIN.',
      );
    } finally {
      setBusy(false);
    }
  }, [unlockApp]);

  useEffect(() => {
    if (!attempted.current) {
      attempted.current = true;
      void authenticate();
    }
  }, [authenticate]);

  const onDigit = async (digit: string) => {
    if (busy || !pin?.pinSet || entry.length >= 6) return;
    const next = entry + digit;
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

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => {}}
      statusBarTranslucent>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.lockIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.xl }]}>
          <AppIcon name="security" size={30} color={colors.primary} weight="semibold" />
        </View>
        <AppText variant="title1" align="center">
          Mori Pay is locked
        </AppText>
        <AppText variant="bodySmall" color={colors.textSecondary} align="center">
          {pinMode
            ? 'Enter your six-digit Mori Pay PIN to continue.'
            : Platform.OS === 'ios'
              ? 'Unlock with Face ID, Touch ID or your device passcode.'
              : 'Unlock with device biometrics, or use your Mori Pay PIN.'}
        </AppText>

        {error ? (
          <StatusBanner tone="error" title="Could not unlock" message={error} />
        ) : null}

        {pinMode ? (
          <>
            {pin?.pinSet ? (
              <>
                <PinBoxes value={entry} />
                <PinKeypad
                  onDigit={(digit) => void onDigit(digit)}
                  onBackspace={() => setEntry((current) => current.slice(0, -1))}
                  disabled={busy}
                />
              </>
            ) : (
              <StatusBanner
                tone="error"
                title="PIN unavailable"
                message="This app lock needs a Mori Pay PIN when device biometrics are unavailable."
              />
            )}
            <PrimaryButton
              label="Try device unlock"
              block
              loading={busy && !pinMode}
              onPress={() => void authenticate()}
            />
          </>
        ) : (
          <SecondaryButton
            label="Use Mori Pay PIN"
            block
            disabled={busy || !pin?.pinSet}
            onPress={() => {
              setPinMode(true);
              setError(null);
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
