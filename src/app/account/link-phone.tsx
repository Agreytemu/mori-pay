import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PinBoxes, PinKeypad, StatusBanner, ProfileField } from '@/components/profile/profile-components';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { requestPhoneLink, verifyPhoneLink } from '@/lib/mori-api';
import { normalizeTzPhone } from '@/lib/phone';
import { useSession } from '@/lib/session';
import { useAppTheme } from '@/theme';

const CODE_LENGTH = 6;

export default function LinkPhoneScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const { reload } = useSession();
  const [phone, setPhone] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const [retryAfter, setRetryAfter] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = setTimeout(() => setRetryAfter((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [retryAfter]);

  const sendCode = async () => {
    const normalized = normalizeTzPhone(phone);
    if (!normalized) {
      setError('Enter a valid Tanzanian number, e.g. 0712 345 678.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await requestPhoneLink({ phone: normalized });
      setNormalizedPhone(normalized);
      setDevCode(result.devCode);
      setRetryAfter(result.retryAfter);
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a verification code.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (value.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyPhoneLink({ phone: normalizedPhone, code: value });
      await reload();
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify this phone number.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const enterDigit = (digit: string) => {
    if (busy || code.length >= CODE_LENGTH || !normalizedPhone) return;
    const next = code + digit;
    setCode(next);
    setError(null);
    if (next.length === CODE_LENGTH) void verify(next);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={normalizedPhone ? 'Verify phone number' : 'Add phone number'}
        subtitle={
          normalizedPhone
            ? `Enter the code sent to +${normalizedPhone}`
            : 'Optional — some phone-based payment features need it.'
        }
        onBack={() => router.back()}
      />
      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {!normalizedPhone ? (
            <>
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
                hint="Use a number that you can receive SMS on."
              />
              {error ? <StatusBanner tone="error" title="Could not send code" message={error} /> : null}
              <PrimaryButton
                label="Send verification code"
                block
                loading={busy}
                disabled={busy || phone.trim().length < 9}
                onPress={() => void sendCode()}
              />
            </>
          ) : (
            <>
              <PinBoxes value={code} secure={false} />
              {devCode ? (
                <StatusBanner
                  tone="info"
                  title="Development code"
                  message={`Your verification code is ${devCode}. This is only shown outside production.`}
                />
              ) : null}
              {error ? <StatusBanner tone="error" title="Could not verify number" message={error} /> : null}
              <SecondaryButton
                label={retryAfter > 0 ? `Resend in ${retryAfter}s` : 'Resend code'}
                block
                disabled={busy || retryAfter > 0}
                onPress={() => void sendCode()}
              />
              <View style={styles.keypad}>
                <PrimaryButton
                  label="Verify number"
                  block
                  loading={busy}
                  disabled={busy || code.length !== CODE_LENGTH}
                  onPress={() => void verify(code)}
                />
                <PinKeypad
                  onDigit={enterDigit}
                  onBackspace={() => setCode((value) => value.slice(0, -1))}
                  disabled={busy}
                />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  body: { flex: 1 },
  bodyContent: { flexGrow: 1, padding: 16, gap: 16 },
  keypad: { marginTop: 'auto', gap: 16, alignItems: 'center' },
});
