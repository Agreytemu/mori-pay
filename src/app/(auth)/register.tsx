import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthBrand } from '@/components/auth/auth-brand';
import { ProfileField, StatusBanner } from '@/components/profile/profile-components';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/button';
import { registerEmail } from '@/lib/mori-api';
import { useAppTheme } from '@/theme';

function splitName(full: string): { fullName: string; firstName: string } {
  const trimmed = full.trim().replace(/\s+/g, ' ');
  const firstName = trimmed.split(' ')[0] ?? trimmed;
  return { fullName: trimmed, firstName };
}

export default function RegisterScreen() {
  const router = useRouter();
  const { colors, space } = useAppTheme();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validDob = dateOfBirth.trim() === '' || /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim());
  const validPassword = password.length >= 10 && password.length <= 128;
  const ready =
    fullName.trim().length >= 2 &&
    validEmail &&
    validDob &&
    validPassword &&
    confirmPassword === password;

  const submit = async () => {
    if (!ready) {
      setError('Check your details. Your password must be at least 10 characters.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { fullName: name, firstName } = splitName(fullName);
      const challenge = await registerEmail({
        fullName: name,
        firstName,
        email: email.trim().toLowerCase(),
        password,
        ...(dateOfBirth.trim() ? { dateOfBirth: dateOfBirth.trim() } : {}),
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
      setError(err instanceof Error ? err.message : 'Could not create your account. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { padding: space.lg, gap: space.lg }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <AuthBrand />
          <View style={styles.heading}>
            <AppText variant="title2">Create your account</AppText>
            <AppText variant="bodySmall" color={colors.textSecondary}>
              No phone number needed to get started. We&apos;ll verify your email.
            </AppText>
          </View>

          <ProfileField
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoComplete="name"
            placeholder="Your full name"
            error={fullName !== '' && fullName.trim().length < 2 ? 'Enter your full name.' : undefined}
          />
          <ProfileField
            label="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            placeholder="you@example.com"
            error={email !== '' && !validEmail ? 'Enter a valid email address.' : undefined}
          />
          <ProfileField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            placeholder="At least 10 characters"
            error={password !== '' && !validPassword ? 'Use at least 10 characters.' : undefined}
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
            error={
              confirmPassword !== '' && confirmPassword !== password
                ? 'Passwords do not match.'
                : undefined
            }
          />
          <ProfileField
            label="Date of birth (optional)"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            keyboardType="numbers-and-punctuation"
            placeholder="1996-04-18"
            hint="Format: YYYY-MM-DD"
            error={dateOfBirth !== '' && !validDob ? 'Use a valid date in YYYY-MM-DD format.' : undefined}
          />

          {error ? (
            <StatusBanner tone="error" title="Could not create account" message={error} />
          ) : null}

          <PrimaryButton
            label="Create account"
            block
            loading={busy}
            disabled={!ready || busy}
            onPress={() => void submit()}
          />

          <View style={styles.footer}>
            <AppText variant="bodySmall" color={colors.textSecondary}>
              Already have an account?
            </AppText>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)/sign-in')}>
              <AppText variant="bodySmallStrong" color={colors.primary}>
                Sign in
              </AppText>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  fill: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  heading: { gap: 4 },
  passwordAction: { alignSelf: 'flex-end', marginTop: -8 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 8 },
});
