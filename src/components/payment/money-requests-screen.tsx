import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MoneyRequest } from '@mori-pay/contracts';

import { AppDialog } from '@/components/ui/app-dialog';
import { AppIllustration } from '@/components/ui/AppIllustration';
import { AppText } from '@/components/ui/AppText';
import { DigitBoxesInput } from '@/components/ui/DigitBoxesInput';
import { Button, SecondaryButton } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { cancelRequest, listRequests, payRequest } from '@/lib/mori-api';
import { useAppTheme } from '@/theme';
import { formatDate } from '@/utils/format';
import { formatMoney } from '@/utils/format-money';

export function MoneyRequestsScreen() {
  const { colors, radius, space } = useAppTheme();
  const [requests, setRequests] = useState<MoneyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<MoneyRequest | null>(null);
  const [pendingPay, setPendingPay] = useState<MoneyRequest | null>(null);
  const [pin, setPin] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchRequests = useCallback(() => listRequests(), []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await fetchRequests());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load money requests.');
    } finally {
      setLoading(false);
    }
  }, [fetchRequests]);

  useEffect(() => {
    let active = true;
    fetchRequests()
      .then((result) => { if (active) setRequests(result); })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load money requests.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchRequests]);

  const confirmCancel = async () => {
    if (!pendingCancel || busyId) return;
    setBusyId(pendingCancel.id);
    setActionError(null);
    try {
      await cancelRequest(pendingCancel.id);
      setPendingCancel(null);
      await reload();
    } catch (cancelError) {
      setActionError(cancelError instanceof Error ? cancelError.message : 'Could not cancel this request.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmPay = async () => {
    if (!pendingPay || busyId) return;
    if (!/^\d{6}$/.test(pin)) {
      setActionError('Enter your six-digit PIN to approve payment.');
      return;
    }
    setBusyId(pendingPay.id);
    setActionError(null);
    try {
      await payRequest(pendingPay.id, {
        pin,
        idempotencyKey: `request-pay-${pendingPay.id}`,
      });
      setPendingPay(null);
      setPin('');
      await reload();
    } catch (payError) {
      setActionError(payError instanceof Error ? payError.message : 'Could not pay this request.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { padding: space.base, gap: space.lg }]}
        showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Money requests" subtitle="Requests linked to your account" />
        {actionError && !pendingPay ? <AppText variant="bodySmall" color={colors.error}>{actionError}</AppText> : null}
        {error ? (
          <View style={styles.stack}>
            <AppIllustration name="noSignal" width={176} height={124} />
            <AppText variant="bodySmall" color={colors.error}>{error}</AppText>
            <SecondaryButton label="Retry" onPress={() => void reload()} />
          </View>
        ) : loading ? (
          <AppText variant="bodySmall" color={colors.textSecondary}>Loading money requests…</AppText>
        ) : requests.length === 0 ? (
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.lg }]}>
            <AppIllustration name="transferMoney" width={176} height={116} />
            <AppText variant="bodyStrong">No money requests</AppText>
            <AppText variant="bodySmall" color={colors.textSecondary} align="center">
              Requests you send or receive will appear here.
            </AppText>
          </View>
        ) : (
          <View style={styles.list}>
            {requests.map((request) => {
              const incoming = request.direction === 'incoming';
              const counterparty = incoming
                ? request.requesterName
                : request.payerName ?? request.payerPhone;
              const pending = request.status === 'pending';
              return (
                <View
                  key={request.id}
                  style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.lg }]}>
                  <View style={styles.cardHeading}>
                    <View style={styles.cardCopy}>
                      <AppText variant="bodyStrong" numberOfLines={1}>
                        {incoming ? `From ${counterparty}` : `To ${counterparty}`}
                      </AppText>
                      <AppText variant="caption" color={colors.textSecondary}>
                        {incoming ? 'Incoming request' : 'Request sent'} · {formatDate(request.createdAt)}
                      </AppText>
                    </View>
                    <AppText variant="bodyStrong" color={colors.primary}>
                      {formatMoney(request.amount, request.currency)}
                    </AppText>
                  </View>
                  {request.note ? <AppText variant="bodySmall" color={colors.textSecondary}>{request.note}</AppText> : null}
                  <View style={styles.cardFooter}>
                    <AppText variant="caption" color={pending ? colors.warning : colors.textTertiary}>
                      {request.status}
                    </AppText>
                    {pending && incoming ? (
                      <Button label="Pay request" loading={busyId === request.id} onPress={() => {
                        setActionError(null);
                        setPin('');
                        setPendingPay(request);
                      }} />
                    ) : pending ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => { setActionError(null); setPendingCancel(request); }}>
                        <AppText variant="caption" color={colors.error}>Cancel request</AppText>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <AppDialog
        visible={pendingCancel !== null}
        title="Cancel request?"
        message={actionError ?? 'The payer will no longer be able to pay this request.'}
        onClose={() => setPendingCancel(null)}
        confirmLabel="Cancel request"
        confirmDestructive
        dismissLabel="Keep request"
        onConfirm={() => void confirmCancel()}
      />

      <Modal
        visible={pendingPay !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { setPendingPay(null); setActionError(null); }}>
        <KeyboardAvoidingView
          style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
              <AppText variant="title3" align="center">Pay money request</AppText>
              <AppText variant="bodySmall" color={colors.textSecondary} align="center">
                {pendingPay ? `${formatMoney(pendingPay.amount, pendingPay.currency)} requested by ${pendingPay.requesterName}.` : ''}
              </AppText>
              <DigitBoxesInput
                accessibilityLabel="Six-digit PIN"
                value={pin}
                onChangeText={(value) => { setPin(value.replace(/\D/g, '').slice(0, 6)); setActionError(null); }}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={6}
                boxCount={6}
                containerStyle={{
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                }}
              />
              {actionError ? <AppText variant="caption" color={colors.error}>{actionError}</AppText> : null}
              <Button label="Confirm payment" loading={busyId === pendingPay?.id} onPress={() => void confirmPay()} />
              <SecondaryButton label="Not now" onPress={() => { setPendingPay(null); setPin(''); setActionError(null); }} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { flexGrow: 1 },
  stack: { gap: 12 },
  list: { gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  cardHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  cardCopy: { flex: 1, gap: 4 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  empty: { borderWidth: StyleSheet.hairlineWidth, padding: 24, alignItems: 'center', gap: 8 },
  modalBackdrop: { flex: 1 },
  modalScrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 440, alignSelf: 'center', borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 14 },
});
