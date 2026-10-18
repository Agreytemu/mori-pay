import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { PinBoxes, StatusBanner } from '@/components/profile/profile-components';
import { AppText } from '@/components/ui/AppText';
import { APP } from '@/constants/app';
import {
  authenticateWithBiometrics,
  cancelBiometricAuthentication,
  getBiometricCapability,
} from '@/lib/biometrics';
import { verifyPin } from '@/lib/mori-api';
import { useSession } from '@/lib/session';
import { useAppTheme } from '@/theme';

export function AppLockPrompt() {
  const { isAppLocked } = useSession();
  return isAppLocked ? <AppLockModal /> : null;
}

function AppLockModal() {
  const { colors } = useAppTheme();
  const {
    unlockApp,
    signOut,
    pin,
    user,
    biometricUnlockEnabled,
    biometricUnlockReady,
  } = useSession();
  const router = useRouter();
  const [entry, setEntry] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const biometricAttempted = useRef(false);
  const biometricInFlight = useRef(false);
  const appIsActiveRef = useRef(AppState.currentState === 'active');
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const active = nextState === 'active';
      appIsActiveRef.current = active;
      setAppIsActive(active);

      if (nextState === 'background') {
        biometricAttempted.current = false;
        if (biometricInFlight.current && Platform.OS === 'android') {
          void cancelBiometricAuthentication().catch((cancelError: unknown) => {
            console.warn('Could not cancel the Android biometric prompt.', cancelError);
          });
        }
      }
    });

    return () => subscription.remove();
  }, []);

  const authenticate = useCallback(async () => {
    if (!appIsActiveRef.current || biometricInFlight.current) return;
    biometricAttempted.current = true;
    biometricInFlight.current = true;
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
      biometricInFlight.current = false;
      setBusy(false);
    }
  }, [unlockApp]);

  useEffect(() => {
    if (
      !biometricUnlockReady ||
      !biometricUnlockEnabled ||
      !appIsActive ||
      biometricAttempted.current
    ) {
      return;
    }

    const timeout = setTimeout(() => {
      if (
        !appIsActiveRef.current ||
        biometricAttempted.current ||
        biometricInFlight.current
      ) {
        return;
      }
      biometricAttempted.current = true;
      void authenticate();
    }, 300);

    return () => clearTimeout(timeout);
  }, [appIsActive, authenticate, biometricUnlockEnabled, biometricUnlockReady, busy]);

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
        <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
          <View pointerEvents="none" style={styles.background}>
            <Svg width="100%" height="100%" viewBox="0 0 400 850" preserveAspectRatio="xMidYMid slice">
              <Defs>
                <RadialGradient id="mintTop" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#BFEBDD" stopOpacity="0.48" />
                  <Stop offset="100%" stopColor="#BFEBDD" stopOpacity="0" />
                </RadialGradient>
                <RadialGradient id="mintMiddle" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#C8EEE5" stopOpacity="0.38" />
                  <Stop offset="100%" stopColor="#C8EEE5" stopOpacity="0" />
                </RadialGradient>
                <RadialGradient id="mintBottom" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor="#C7EBDD" stopOpacity="0.32" />
                  <Stop offset="100%" stopColor="#C7EBDD" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx="390" cy="125" r="185" fill="url(#mintTop)" />
              <Circle cx="92" cy="410" r="175" fill="url(#mintMiddle)" />
              <Circle cx="210" cy="735" r="215" fill="url(#mintBottom)" />
            </Svg>
          </View>
          <ScrollView
            contentContainerStyle={styles.screen}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            bounces={false}>
            <View style={styles.brand}>
              <AppText
                variant="title1"
                color="#078B63"
                style={styles.wordmark}>
                {APP.name}
              </AppText>
            </View>

            <View style={styles.lockContent}>
              {error ? (
                <StatusBanner tone="error" title="Could not unlock" message={error} />
              ) : null}

              <AppText variant="body" color="#707572" align="center" style={styles.instruction}>
                {user?.firstName
                  ? `Welcome back, ${user.firstName}. Enter your 6-digit PIN to continue.`
                  : 'Enter your 6-digit PIN to continue.'}
              </AppText>

              {pin?.pinSet ? (
                <PinBoxes
                  value={entry}
                  cellHeight={64}
                  maxCellWidth={58}
                  cellStyle={styles.pinCell}
                  containerStyle={styles.pinInput}
                  autoFocus={false}
                  onChangeText={(value) => void onPinChange(value)}
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
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void authenticate()}
                  style={styles.secondaryLink}>
                  <AppText variant="bodySmallStrong" color="#078B63">
                    {busy ? 'Checking biometrics…' : 'Try biometrics again'}
                  </AppText>
                </Pressable>
              ) : null}

              <View style={styles.passwordLink}>
                <AppText variant="bodySmall" color={colors.textSecondary}>
                  Trouble signing in?{' '}
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => void signInWithPassword()}>
                  <AppText variant="bodySmallStrong" color="#078B63">
                    Use password instead
                  </AppText>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F8F9F7' },
  background: {
    ...StyleSheet.absoluteFill,
  },
  screen: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 42,
    paddingBottom: 20,
  },
  brand: {
    alignItems: 'center',
    marginTop: 8,
  },
  wordmark: {
    fontSize: 48,
    lineHeight: 58,
    fontWeight: '700',
    letterSpacing: -1.2,
  },
  lockContent: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 20,
  },
  instruction: {
    marginBottom: 2,
  },
  pinInput: {
    minHeight: 70,
    backgroundColor: 'transparent',
  },
  pinCell: {
    borderRadius: 12,
    borderColor: '#E6E7E5',
    backgroundColor: '#FFFFFF',
  },
  secondaryLink: {
    alignSelf: 'center',
    paddingVertical: 3,
  },
  passwordLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 2,
  },
});
