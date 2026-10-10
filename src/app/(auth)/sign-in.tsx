import { useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileField, StatusBanner } from '@/components/profile/profile-components';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { PrimaryButton } from '@/components/ui/button';
import { APP } from '@/constants/app';
import { requestOtp } from '@/lib/mori-api';
import { normalizeTzPhone } from '@/lib/phone';
import { useAppTheme } from '@/theme';

export default function SignInScreen() {
  const router = useRouter();
  const { colors, space, radius } = useAppTheme();

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
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { padding: space.lg, gap: space.lg }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={[styles.brand, { gap: space.sm }]}>
            <View style={[styles.brandMark, { backgroundColor: colors.primarySoft, borderRadius: radius.lg }]}>
              <AppIcon name="wallet" size={26} color={colors.primary} weight="semibold" />
            </View>
            <AppText variant="title1">{APP.name}</AppText>
            <AppText variant="bodySmall" color={colors.textSecondary} align="center">
              {APP.tagline}
            </AppText>
          </View>

          <View style={[styles.form, { gap: space.lg }]}>
            <AppText variant="title3">Sign in</AppText>
            <AppText variant="bodySmall" color={colors.textSecondary}>
              Enter your mobile number. We&apos;ll text you a 6-digit verification code.
            </AppText>

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
              hint="Include your country code, or use the 0-prefixed local format."
              error={error ?? undefined}
            />

            {error ? (
              <StatusBanner tone="error" title="Check your number" message={error} />
            ) : null}

            <PrimaryButton label="Send code" block loading={busy} disabled={phone.trim().length < 9} onPress={submit} />
          </View>

          <AppText variant="caption" color={colors.textTertiary} align="center">
            By continuing you agree to the Terms of Service and Privacy Policy.
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  fill: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center', justifyContent: 'center' },
  brand: { alignItems: 'center' },
  brandMark: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  form: {},
});
