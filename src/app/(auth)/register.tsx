import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileField, StatusBanner } from '@/components/profile/profile-components';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { PrimaryButton } from '@/components/ui/button';
import { register } from '@/lib/mori-api';
import { useSession } from '@/lib/session';
import { useAppTheme } from '@/theme';

function splitName(full: string): { fullName: string; firstName: string } {
  const trimmed = full.trim().replace(/\s+/g, ' ');
  const firstName = trimmed.split(' ')[0] ?? trimmed;
  return { fullName: trimmed, firstName };
}

export default function RegisterScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { signIn } = useSession();
  const params = useLocalSearchParams<{ setupToken: string }>();
  const setupToken = typeof params.setupToken === 'string' ? params.setupToken : '';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validName = fullName.trim().length >= 3;
  const validEmail = email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const validDob = dateOfBirth.trim() === '' || /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth.trim());

  const submit = async () => {
    if (!setupToken) {
      setError('Your registration session expired. Start again from Sign in.');
      return;
    }
    if (!validName || !validEmail || !validDob) {
      setError('Please correct the highlighted details.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { fullName: name, firstName } = splitName(fullName);
      const session = await register({
        setupToken,
        fullName: name,
        firstName,
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(dateOfBirth.trim() ? { dateOfBirth: dateOfBirth.trim() } : {}),
      });
      await signIn(session);
      router.replace('/(auth)/set-pin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Create your account" subtitle="A few quick details" onBack={() => router.back()} />
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <ProfileField
            label="Full name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoComplete="name"
            placeholder="Agrey Temu"
            error={fullName !== '' && !validName ? 'Enter your full name.' : undefined}
          />
          <ProfileField
            label="Email (optional)"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="you@example.co.tz"
            error={email !== '' && !validEmail ? 'Enter a valid email address.' : undefined}
          />
          <ProfileField
            label="Date of birth (optional)"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            keyboardType="numbers-and-punctuation"
            placeholder="1996-04-18"
            hint="Format: YYYY-MM-DD"
            error={dateOfBirth !== '' && !validDob ? 'Use the format YYYY-MM-DD.' : undefined}
          />

          {error ? <StatusBanner tone="error" title="Could not create account" message={error} /> : null}

          <View style={styles.footer}>
            <PrimaryButton label="Create account" block loading={busy} disabled={!validName} onPress={submit} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  fill: { flex: 1 },
  content: { padding: 16, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  footer: { marginTop: 8 },
});
