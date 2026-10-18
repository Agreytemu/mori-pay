import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AuthPage } from '@/components/auth/AuthPage';
import { PinBoxes, StatusBanner } from '@/components/profile/profile-components';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/button';
import { setPin } from '@/lib/mori-api';
import { useSession } from '@/lib/session';
import { useAppTheme } from '@/theme';

const PIN_LENGTH = 6;
const SEQUENTIAL = ['012345', '123456', '234567', '345678', '456789', '987654', '876543'];

type Step = 'new' | 'confirm' | 'success';

const COPY: Record<Exclude<Step, 'success'>, { title: string; hint: string }> = {
  new: {
    title: 'Create your PIN',
    hint: `Choose a ${PIN_LENGTH}-digit PIN. You'll use it for every payment.`,
  },
  confirm: {
    title: 'Confirm your PIN',
    hint: 'Enter the same six digits again.',
  },
};

export default function SetPinScreen() {
  const router = useRouter();
  const { colors, radius } = useAppTheme();
  const { setPin: setPinState, setAppLockEnabled } = useSession();

  const [step, setStep] = useState<Step>('new');
  const [entry, setEntry] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleEntryChange = async (next: string) => {
    if (busy) return;
    setEntry(next);
    setError(null);
    if (next.length !== PIN_LENGTH) return;

    if (step === 'new') {
      if (new RegExp(`^(\\d)\\1{${PIN_LENGTH - 1}}$`).test(next) || SEQUENTIAL.includes(next)) {
        setError('That PIN is too easy to guess. Pick a less obvious combination.');
        setEntry('');
        return;
      }
      setFirstPin(next);
      setStep('confirm');
      setEntry('');
      return;
    }

    // confirm step
    if (next !== firstPin) {
      setError('The PINs do not match. Start again.');
      setEntry('');
      setFirstPin('');
      setStep('new');
      return;
    }

    setBusy(true);
    try {
      const status = await setPin({ pin: next });
      setPinState(status);
      try {
        await setAppLockEnabled(true);
      } catch {
        // PIN creation still succeeds even if app lock cannot be enabled.
      }
      setStep('success');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your PIN.');
      setEntry('');
      setFirstPin('');
      setStep('new');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'success') {
    return (
      <AuthPage>
        <View style={styles.success}>
          <View style={[styles.successIcon, { backgroundColor: colors.successSoft, borderRadius: radius.xl }]}>
            <AppText variant="title1" color={colors.success}>
              OK
            </AppText>
          </View>
          <AppText variant="title2" align="center">
            PIN created
          </AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} align="center">
            Your {PIN_LENGTH}-digit PIN protects every payment. Never share it with anyone.
          </AppText>
          <PrimaryButton label="Get started" block onPress={() => router.replace('/(tabs)')} />
        </View>
      </AuthPage>
    );
  }

  const copy = COPY[step];

  return (
    <AuthPage onBack={() => router.back()}>
      <View style={styles.body}>
        <AppText variant="title3" align="center">
          {copy.title}
        </AppText>
        <AppText variant="bodySmall" color={colors.textSecondary} align="center">
          {copy.hint}
        </AppText>

        <PinBoxes
          key={step}
          value={entry}
          onChangeText={(value) => void handleEntryChange(value)}
          autoFocus
          editable={!busy}
        />

        {error ? (
          <StatusBanner tone="error" title="Check your PIN" message={error} onDismiss={() => setError(null)} />
        ) : null}

      </View>
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: 16, gap: 16, alignItems: 'center' },
  success: { flex: 1, padding: 24, gap: 16, alignItems: 'center', justifyContent: 'center' },
  successIcon: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
});
