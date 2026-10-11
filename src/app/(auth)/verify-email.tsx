import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PinDots, PinKeypad, StatusBanner } from '@/components/profile/profile-components';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { GhostButton, PrimaryButton } from '@/components/ui/button';
import {
  resendEmailVerification,
  verifyEmail,
} from '@/lib/mori-api';
import { deviceInfo } from '@/lib/phone';
import { useSession } from '@/lib/session';
import { useAppTheme } from '@/theme';

const CODE_LENGTH = 6;

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { signIn } = useSession();
  const params = useLocalSearchParams<{
    email: string;
    devCode?: string;
    retryAfter?: string;
  }>();
  const email = typeof params.email === 'string' ? params.email : '';
  const initialDevCode = typeof params.devCode === 'string' ? params.devCode : undefined;

  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(initialDevCode);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(
    Number(typeof params.retryAfter === 'string' ? params.retryAfter : 30) || 30
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = useCallback(
    async (value: string) => {
      if (value.length !== CODE_LENGTH || busy || !email) return;
      setBusy(true);
      setError(null);
      try {
        const device = await deviceInfo();
        const session = await verifyEmail({
          email,
          code: value,
          device,
        });
        const pinStatus = await signIn(session);
        router.replace(pinStatus.pinSet ? '/(tabs)' : '/(auth)/set-pin');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed. Try again.');
        setCode('');
      } finally {
        setBusy(false);
      }
    },
    [busy, email, router, signIn]
  );

  const onDigit = (digit: string) => {
    if (busy || code.length >= CODE_LENGTH) return;
    const next = code + digit;
    setCode(next);
    setError(null);
    if (next.length === CODE_LENGTH) void submit(next);
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    try {
      const challenge = await resendEmailVerification(email);
      setCooldown(challenge.retryAfter);
      setDevCode(challenge.devCode);
      setCode('');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Verify your email"
        subtitle={`We sent a 6-digit code to ${email}`}
        onBack={() => router.back()}
      />
      <View style={styles.body}>
        <PinDots length={code.length} revealed />

        {devCode ? (
          <StatusBanner
            tone="info"
            title="Development code"
            message={`Your verification code is ${devCode}. This is only shown outside production.`}
          />
        ) : null}

        {error ? (
          <StatusBanner
            tone="error"
            title="Could not verify email"
            message={error}
            onDismiss={() => setError(null)}
          />
        ) : null}

        <GhostButton
          label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          disabled={cooldown > 0 || busy}
          onPress={() => void resend()}
        />

        <View style={styles.footer}>
          <PrimaryButton
            label="Verify email"
            block
            loading={busy}
            disabled={busy || code.length !== CODE_LENGTH}
            onPress={() => void submit(code)}
          />
          <PinKeypad
            onDigit={onDigit}
            onBackspace={() => setCode((value) => value.slice(0, -1))}
            disabled={busy}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  body: { flex: 1, padding: 16, gap: 16, alignItems: 'center' },
  footer: { marginTop: 'auto', width: '100%', gap: 16, alignItems: 'center' },
});
