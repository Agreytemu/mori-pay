import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthPage } from '@/components/auth/AuthPage';
import { ProfileField, StatusBanner } from '@/components/profile/profile-components';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/button';
import { setEmailCredentials } from '@/lib/mori-api';
import { useSession } from '@/lib/session';
import { useAppTheme } from '@/theme';

export default function SetupCredentialsScreen() {
  const router = useRouter();
  const { colors, space } = useAppTheme();
  const { user } = useSession();
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ready =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    password.length >= 10 &&
    password.length <= 128 &&
    password === confirmPassword;

  const submit = async () => {
    if (!ready) {
      setError('Use a valid email and a matching password of at least 10 characters.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const challenge = await setEmailCredentials({
        email: email.trim().toLowerCase(),
        password,
      });
      router.push({
        pathname: '/(auth)/verify-email',
        params: {
          email: email.trim().toLowerCase(),
          retryAfter: String(challenge.retryAfter),
          ...(challenge.devCode ? { devCode: challenge.devCode } : {}),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your sign-in details.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPage onBack={() => router.back()} contentStyle={{ gap: space.lg }}>
          <View style={styles.heading}>
            <AppText variant="title2">Add email sign-in</AppText>
            <AppText variant="bodySmall" color={colors.textSecondary}>
              Verify your email and create a password to sign in without your phone number.
            </AppText>
          </View>

          <ProfileField
            label="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            placeholder="you@example.com"
          />
          <ProfileField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="At least 10 characters"
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowPassword((value) => !value)}
            style={styles.passwordAction}>
            <AppText variant="caption" color={colors.primary}>
              {showPassword ? 'Hide password' : 'Show password'}
            </AppText>
          </Pressable>
          <ProfileField
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="Enter your password again"
          />

          {error ? <StatusBanner tone="error" title="Could not save details" message={error} /> : null}
          <PrimaryButton
            label="Save and verify email"
            block
            loading={busy}
            disabled={!ready || busy}
            onPress={() => void submit()}
          />
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  heading: { gap: 4 },
  passwordAction: { alignSelf: 'flex-end', marginTop: -8 },
});
