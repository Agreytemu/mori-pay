import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { AuthPage } from '@/components/auth/AuthPage';
import { ProfileField, StatusBanner } from '@/components/profile/profile-components';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/button';
import { signInWithEmail, signInWithPin } from '@/lib/mori-api';
import { deviceInfo } from '@/lib/phone';
import { useSession } from '@/lib/session';
import { useAppTheme } from '@/theme';

type SignInMode = 'password' | 'pin';

export default function SignInScreen() {
  const router = useRouter();
  const { colors, radius, space } = useAppTheme();
  const { signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [mode, setMode] = useState<SignInMode>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }
    if (mode === 'password' && password.length === 0) {
      setError('Enter your password.');
      return;
    }
    if (mode === 'pin' && !/^\d{6}$/.test(pin)) {
      setError('Enter your 6-digit PIN.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const device = await deviceInfo();
      const session =
        mode === 'password'
          ? await signInWithEmail({
              email: normalizedEmail,
              password,
              device,
            })
          : await signInWithPin({
              email: normalizedEmail,
              pin,
              device,
            });
      const pinStatus = await signIn(session);
      router.replace(pinStatus.pinSet ? '/(tabs)' : '/(auth)/set-pin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthPage contentStyle={{ gap: space.xl }}>
          <View style={[styles.form, { gap: space.md }]}>
            <View style={styles.heading}>
              <AppText variant="title2">Welcome back</AppText>
              <AppText variant="bodySmall" color={colors.textSecondary}>
                Sign in securely with your email and password.
              </AppText>
            </View>

            <View
              accessibilityRole="tablist"
              style={[
                styles.modeSwitch,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                },
              ]}>
              {(['password', 'pin'] as const).map((item) => {
                const selected = mode === item;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setMode(item);
                      setError(null);
                    }}
                    style={[
                      styles.modeOption,
                      {
                        backgroundColor: selected ? colors.primary : 'transparent',
                        borderRadius: radius.sm,
                      },
                    ]}>
                    <AppText
                      variant="bodySmallStrong"
                      color={selected ? colors.onPrimary : colors.textSecondary}>
                      {item === 'password' ? 'Password' : 'PIN'}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <ProfileField
              label="Email address"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (error) setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              placeholder="you@example.com"
              returnKeyType={mode === 'password' ? 'next' : 'done'}
              onSubmitEditing={() => void submit()}
            />

            {mode === 'password' ? (
              <View>
                <ProfileField
                  label="Password"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (error) setError(null);
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setShowPassword((value) => !value)}
                  style={styles.trailingAction}>
                  <AppText variant="caption" color={colors.primary}>
                    {showPassword ? 'Hide password' : 'Show password'}
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({
                      pathname: '/(auth)/reset-password',
                      params: { email: email.trim().toLowerCase() },
                    })
                  }
                  style={styles.forgotAction}>
                  <AppText variant="bodySmallStrong" color={colors.primary}>
                    Forgot password?
                  </AppText>
                </Pressable>
              </View>
            ) : (
              <ProfileField
                label="6-digit PIN"
                value={pin}
                onChangeText={(value) => {
                  setPin(value.replace(/\D/g, '').slice(0, 6));
                  if (error) setError(null);
                }}
                keyboardType="number-pad"
                secureTextEntry
                digitBoxes
                autoComplete="off"
                placeholder="••••••"
                maxLength={6}
                onSubmitEditing={() => void submit()}
              />
            )}

            {error ? (
              <StatusBanner tone="error" title="Could not sign in" message={error} />
            ) : null}

            <PrimaryButton
              label={mode === 'password' ? 'Sign in' : 'Sign in with PIN'}
              block
              loading={busy}
              disabled={busy}
              onPress={() => void submit()}
            />

            <View style={styles.links}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/(auth)/register')}>
                <AppText variant="bodySmallStrong" color={colors.primary}>
                  Create an account
                </AppText>
              </Pressable>
            </View>
          </View>

          <AppText variant="caption" color={colors.textTertiary} align="center">
            Secured by Mori Pay.
          </AppText>
    </AuthPage>
  );
}

const styles = StyleSheet.create({
  form: {},
  heading: { gap: 4 },
  modeSwitch: {
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    padding: 4,
    gap: 4,
  },
  modeOption: {
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailingAction: { alignSelf: 'flex-end', marginTop: 8 },
  forgotAction: { alignSelf: 'flex-end', marginTop: 16 },
  links: { alignItems: 'center', gap: 16, paddingTop: 4 },
});
