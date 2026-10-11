import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AuthPage } from '@/components/auth/AuthPage';
import { ProfileField, StatusBanner } from '@/components/profile/profile-components';
import { AppText } from '@/components/ui/AppText';
import { GhostButton, PrimaryButton } from '@/components/ui/button';
import { requestPasswordReset, resetPassword } from '@/lib/mori-api';
import { useAppTheme } from '@/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const { colors, space } = useAppTheme();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const sendCode = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const challenge = await requestPasswordReset({ email: normalizedEmail });
      setEmail(normalizedEmail);
      setSent(true);
      setCooldown(challenge.retryAfter);
      setDevCode(challenge.devCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request a reset code.');
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (password.length < 10 || password.length > 128 || password !== confirmPassword) {
      setError('Use a matching password of at least 10 characters.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await resetPassword({ email, code, password });
      setComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPage onBack={() => router.back()} contentStyle={{ gap: space.lg }}>
          <View style={styles.heading}>
            <AppText variant="title2">
              {complete ? 'Password updated' : 'Reset your password'}
            </AppText>
            <AppText variant="bodySmall" color={colors.textSecondary}>
              {complete
                ? 'Your password has been changed. Sign in with your new password.'
                : 'We’ll email a one-time code to the address on your account.'}
            </AppText>
          </View>

          {!complete ? (
            <>
              <ProfileField
                label="Email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                editable={!sent}
                placeholder="you@example.com"
              />

              {sent ? (
                <>
                  <StatusBanner
                    tone="info"
                    title="Check your inbox"
                    message="If this email belongs to a verified Mori Pay account, a reset code has been sent."
                  />
                  {devCode ? (
                    <StatusBanner
                      tone="info"
                      title="Development code"
                      message={`Your reset code is ${devCode}. This is only shown outside production.`}
                    />
                  ) : null}
                  <ProfileField
                    label="6-digit code"
                    value={code}
                    onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    digitBoxes
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                  />
                  <ProfileField
                    label="New password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="new-password"
                    placeholder="At least 10 characters"
                  />
                  <ProfileField
                    label="Confirm new password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="new-password"
                    placeholder="Enter your new password again"
                  />
                  <GhostButton
                    label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                    disabled={cooldown > 0 || busy}
                    onPress={() => void sendCode()}
                  />
                </>
              ) : null}

              {error ? <StatusBanner tone="error" title="Could not reset password" message={error} /> : null}
              <PrimaryButton
                label={sent ? 'Update password' : 'Send reset code'}
                block
                loading={busy}
                disabled={busy}
                onPress={() => void (sent ? submit() : sendCode())}
              />
            </>
          ) : (
            <PrimaryButton
              label="Back to sign in"
              block
              onPress={() => router.replace('/(auth)/sign-in')}
            />
          )}
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 4 },
});
