import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AuthPage } from '@/components/auth/AuthPage';
import { PinBoxes, PinKeypad, StatusBanner } from '@/components/profile/profile-components';
import { GhostButton, PrimaryButton } from '@/components/ui/button';
import { AppText } from '@/components/ui/AppText';
import { requestOtp, verifyOtp } from '@/lib/mori-api';
import { deviceInfo } from '@/lib/phone';
import { useSession } from '@/lib/session';
import { useAppTheme } from '@/theme';
import { formatPhone } from '@/utils/format';

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { signIn } = useSession();

  const params = useLocalSearchParams<{ phone: string; devCode?: string; retryAfter?: string }>();
  const phone = typeof params.phone === 'string' ? params.phone : '';
  const devCode = typeof params.devCode === 'string' ? params.devCode : undefined;

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [needsEmailRegistration, setNeedsEmailRegistration] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(
    Number(typeof params.retryAfter === 'string' ? params.retryAfter : 30) || 30
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const finish = useCallback(
    async (result: Awaited<ReturnType<typeof verifyOtp>>) => {
      if (result.registrationRequired) {
        setNeedsEmailRegistration(true);
        setError(
          'This phone number is not linked to an existing account. Create an account with email, then add this phone from Personal Information.'
        );
        return;
      }
      const pinStatus = await signIn(result.session);
      router.replace(
        !result.session.user.hasPassword
          ? '/(auth)/setup-credentials'
          : !result.session.user.emailVerified
            ? {
                pathname: '/(auth)/verify-email',
                params: { email: result.session.user.email ?? '' },
              }
            : pinStatus.pinSet
              ? '/(tabs)'
              : '/(auth)/set-pin'
      );
    },
    [router, signIn]
  );

  const submit = useCallback(
    async (value: string) => {
      if (value.length !== CODE_LENGTH || busy) return;
      setBusy(true);
      setError(null);
      try {
        setNeedsEmailRegistration(false);
        const device = await deviceInfo();
        await finish(await verifyOtp({ phone, code: value, device }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Verification failed. Try again.');
        setCode('');
      } finally {
        setBusy(false);
      }
    },
    [busy, finish, phone]
  );

  const onDigit = (digit: string) => {
    if (busy || code.length >= CODE_LENGTH) return;
    const next = code + digit;
    setCode(next);
    setError(null);
    if (next.length === CODE_LENGTH) void submit(next);
  };

  const resend = async () => {
    if (cooldown > 0) return;
    try {
      const challenge = await requestOtp({ phone });
      setCooldown(challenge.retryAfter);
      setCode('');
      setError(null);
      setNeedsEmailRegistration(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.');
    }
  };

  return (
    <AuthPage onBack={() => router.back()}>
      <View style={styles.body}>
        <View style={styles.heading}>
          <AppText variant="title2">Enter the code</AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} align="center">
            Sent to {formatPhone(phone)}
          </AppText>
        </View>
        <PinBoxes value={code} secure={false} />

        {devCode ? (
          <StatusBanner
            tone="info"
            title="Sandbox code"
            message={`Your verification code is ${devCode}. It is only shown in development.`}
          />
        ) : null}

        {error ? (
          <StatusBanner
            tone="error"
            title={needsEmailRegistration ? 'No existing account found' : 'That code is wrong'}
            message={error}
            onDismiss={() => setError(null)}
          />
        ) : null}

        {needsEmailRegistration ? (
          <PrimaryButton
            label="Create an email account"
            block
            onPress={() => router.replace('/(auth)/register')}
          />
        ) : null}

        <GhostButton
          label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          disabled={cooldown > 0}
          onPress={() => void resend()}
        />

        <View style={styles.footer}>
          <PrimaryButton
            label="Verify"
            block
            loading={busy}
            disabled={code.length !== CODE_LENGTH}
            onPress={() => void submit(code)}
          />
          <PinKeypad onDigit={onDigit} onBackspace={() => setCode((v) => v.slice(0, -1))} disabled={busy} />
        </View>
      </View>
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: 16, gap: 16, alignItems: 'center' },
  heading: { gap: 4, alignItems: 'center' },
  footer: { marginTop: 'auto', width: '100%', gap: 16, alignItems: 'center' },
});
