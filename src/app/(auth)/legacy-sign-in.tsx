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
import { requestOtp } from '@/lib/mori-api';
import { normalizeTzPhone } from '@/lib/phone';
import { useAppTheme } from '@/theme';

export default function LegacySignInScreen() {
  const router = useRouter();
  const { colors, space } = useAppTheme();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const normalized = normalizeTzPhone(phone);
    if (!normalized) {
      setError('Enter a valid Tanzanian number, e.g. 0712 345 678.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const challenge = await requestOtp({ phone: normalized });
      router.push({
        pathname: '/(auth)/verify',
        params: {
          phone: normalized,
          retryAfter: String(challenge.retryAfter),
          ...(challenge.devCode ? { devCode: challenge.devCode } : {}),
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code. Try again.');
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
            <AppText variant="title2">Existing account</AppText>
            <AppText variant="bodySmall" color={colors.textSecondary}>
              Use the phone number already linked to your Mori Pay account to receive a one-time code.
            </AppText>
          </View>
          <ProfileField
            label="Mobile number"
            value={phone}
            onChangeText={(value) => {
              setPhone(value);
              if (error) setError(null);
            }}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="0712 345 678"
            hint="This recovery option is only for accounts created before email sign-in."
            error={error ?? undefined}
          />

          {error ? <StatusBanner tone="error" title="Could not send code" message={error} /> : null}

          <PrimaryButton
            label="Send sign-in code"
            block
            loading={busy}
            disabled={busy || phone.trim().length < 9}
            onPress={() => void submit()}
          />
          <View style={styles.links}>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)/sign-in')}>
              <AppText variant="bodySmallStrong" color={colors.primary}>
                Sign in with email
              </AppText>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/register')}>
              <AppText variant="caption" color={colors.textTertiary}>
                Create a new account with email
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
  content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', justifyContent: 'center' },
  heading: { gap: 4 },
  links: { alignItems: 'center', gap: 14 },
});
