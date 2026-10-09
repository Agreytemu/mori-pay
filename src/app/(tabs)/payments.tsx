import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AmountInput,
  FlowHeader,
  FlowOverviewCard,
  PaymentFailed,
  PaymentMethodSelector,
  PaymentPending,
  PaymentReview,
  PaymentStatus,
  PaymentSuccess,
  ReceiptDetails,
  RecipientSelector,
} from '@/components/payment/payment-components';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/button';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import type { PaymentMethod } from '@/data/payment-data';
import { PAYMENT_METHOD_TYPES } from '@/data/mock-payment-methods';
import {
  PAYMENT_MERCHANTS,
  PAYMENT_RECIPIENTS,
  SAMPLE_RECEIPT_REFERENCE,
  SAMPLE_REFERENCE,
} from '@/data/payment-data';
import { useAppTheme } from '@/theme';
import { formatMoney } from '@/utils/format-money';

type FlowName =
  | 'overview'
  | 'send-recipient'
  | 'send-amount'
  | 'send-review'
  | 'send-result'
  | 'receive'
  | 'request-recipient'
  | 'request-amount'
  | 'request-review'
  | 'request-result'
  | 'pay-merchant'
  | 'pay-amount'
  | 'pay-review'
  | 'pay-result'
  | 'receipt';

type ResultState = 'success' | 'failed' | 'pending';

const QR_SIZE = 15;

function isQrFinderCell(row: number, column: number): boolean | undefined {
  const positions = [
    [0, 0],
    [0, QR_SIZE - 5],
    [QR_SIZE - 5, 0],
  ] as const;

  for (const [top, left] of positions) {
    const localRow = row - top;
    const localColumn = column - left;
    if (localRow >= 0 && localRow < 5 && localColumn >= 0 && localColumn < 5) {
      return (
        localRow === 0 ||
        localRow === 4 ||
        localColumn === 0 ||
        localColumn === 4 ||
        (localRow === 2 && localColumn === 2)
      );
    }
  }

  return undefined;
}

export default function PaymentsScreen() {
  const { colors } = useAppTheme();
  const router = useRouter();
  const { startFlow } = useLocalSearchParams<{ startFlow?: 'send' | 'receive' }>();
  const [screen, setScreen] = useState<FlowName>('overview');
  const [phone, setPhone] = useState('+255 712 345 678');
  const [sendRecipientId, setSendRecipientId] = useState(PAYMENT_RECIPIENTS[0].id);
  const [requestRecipientId, setRequestRecipientId] = useState(PAYMENT_RECIPIENTS[1].id);
  const [payMethodId, setPayMethodId] = useState(PAYMENT_METHOD_TYPES[0].id);
  const [sendAmount, setSendAmount] = useState('250000');
  const [requestAmount, setRequestAmount] = useState('75000');
  const [payAmount, setPayAmount] = useState('180000');
  const [sendNote, setSendNote] = useState('School fees');
  const [requestNote, setRequestNote] = useState('Dinner contribution');
  const [payNote, setPayNote] = useState('Groceries');
  const [resultState, setResultState] = useState<ResultState>('success');

  const sendRecipient = useMemo(
    () => PAYMENT_RECIPIENTS.find((person) => person.id === sendRecipientId) ?? PAYMENT_RECIPIENTS[0],
    [sendRecipientId]
  );
  const requestRecipient = useMemo(
    () => PAYMENT_RECIPIENTS.find((person) => person.id === requestRecipientId) ?? PAYMENT_RECIPIENTS[1],
    [requestRecipientId]
  );
  const merchant = PAYMENT_MERCHANTS[0];
  const selectedPayMethod =
    PAYMENT_METHOD_TYPES.find((method) => method.id === payMethodId) ?? PAYMENT_METHOD_TYPES[0];

  const fee = 5000;
  const total = Number(sendAmount || '0') + fee;
  const payTotal = Number(payAmount || '0') + fee;

  const activeScreen: FlowName =
    screen === 'overview' && startFlow === 'send'
      ? 'send-recipient'
      : screen === 'overview' && startFlow === 'receive'
        ? 'receive'
        : screen;

  const goHome = () => {
    router.setParams({ startFlow: undefined });
    setScreen('overview');
  };
  const openFlow = (flow: 'send' | 'receive' | 'request' | 'pay') => {
    if (flow === 'send') setScreen('send-recipient');
    if (flow === 'receive') setScreen('receive');
    if (flow === 'request') setScreen('request-recipient');
    if (flow === 'pay') setScreen('pay-merchant');
  };

  const renderOverview = () => (
    <View style={styles.stack}>
      <View style={styles.sectionTitleWrap}>
        <AppText variant="bodySmall" color={colors.textSecondary}>
          Choose how you want to move money.
        </AppText>
      </View>
      <FlowOverviewCard
        title="Send money"
        description="Transfer to a person or family member."
        icon="send"
        onPress={() => openFlow('send')}
      />
      <FlowOverviewCard
        title="Receive money"
        description="Share your phone or QR and collect funds."
        icon="receive"
        onPress={() => openFlow('receive')}
      />
      <FlowOverviewCard
        title="Request money"
        description="Ask someone to send the amount they owe."
        icon="request"
        onPress={() => openFlow('request')}
      />
      <FlowOverviewCard
        title="Pay"
        description="Buy from merchants and businesses."
        icon="pay"
        onPress={() => openFlow('pay')}
      />
    </View>
  );

  const sendTransactionRow = [
    { label: 'Recipient', value: sendRecipient.name },
    { label: 'Phone number', value: sendRecipient.phone },
    { label: 'Amount', value: formatMoney(Number(sendAmount || '0'), 'TZS') },
    { label: 'Fee', value: formatMoney(fee, 'TZS'), muted: true },
    { label: 'Total', value: formatMoney(total, 'TZS') },
    { label: 'Note', value: sendNote || 'No note' },
  ];

  const payTransactionRow = [
    { label: 'Merchant', value: merchant.name },
    { label: 'Amount', value: formatMoney(Number(payAmount || '0'), 'TZS') },
    { label: 'Fee', value: formatMoney(fee, 'TZS'), muted: true },
    { label: 'Total', value: formatMoney(payTotal, 'TZS') },
    { label: 'Payment method', value: selectedPayMethod.name },
  ];

  const requestRows = [
    { label: 'Requested from', value: requestRecipient.name },
    { label: 'Amount', value: formatMoney(Number(requestAmount || '0'), 'TZS') },
    { label: 'Note', value: requestNote || 'No note' },
  ];

  const renderSendRecipient = () => (
    <View style={styles.stack}>
      <RecipientSelector
        title="Recipient"
        value={phone}
        onPhoneChange={setPhone}
        recipients={PAYMENT_RECIPIENTS}
        selectedId={sendRecipientId}
        onSelect={(recipient) => { setSendRecipientId(recipient.id); setPhone(recipient.phone); }}
      />
      <Button label="Continue" onPress={() => setScreen('send-amount')} />
    </View>
  );

  const renderSendAmount = () => (
    <View style={styles.stack}>
      <AmountInput
        value={sendAmount}
        onChangeText={setSendAmount}
        note={sendNote}
        onNoteChange={setSendNote}
        title="Amount"
        subtitle="Optional note"
      />
      <Button label="Continue" onPress={() => setScreen('send-review')} />
    </View>
  );

  const renderSendReview = () => (
    <PaymentReview
      title="Review transfer"
      subtitle="Check your details before confirming."
      rows={sendTransactionRow}
      primaryLabel="Confirm"
      secondaryLabel="Edit"
      onPrimary={() => setScreen('send-result')}
      onSecondary={() => setScreen('send-amount')}
    />
  );

  const renderSendResult = () => (
    <View style={styles.stack}>
      <View style={styles.resultTabs}>
        {(['success', 'failed', 'pending'] as ResultState[]).map((state) => (
          <Pressable
            key={state}
            accessibilityRole="button"
            onPress={() => setResultState(state)}
            style={({ pressed }) => [
              styles.tabPill,
              {
                backgroundColor: resultState === state ? colors.primarySoft : colors.surface,
                borderColor: resultState === state ? colors.primary : colors.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}>
            <AppText variant="bodySmallStrong" color={resultState === state ? colors.primary : colors.textSecondary}>
              {state.charAt(0).toUpperCase() + state.slice(1)}
            </AppText>
          </Pressable>
        ))}
      </View>

      {resultState === 'success' && (
        <PaymentSuccess
          amount={Number(sendAmount || '0')}
          recipient={sendRecipient.name}
          reference={SAMPLE_REFERENCE}
          dateTime="Today, 13:42"
          onPrimary={() => setScreen('receipt')}
          onSecondary={goHome}
        />
      )}
      {resultState === 'failed' && (
        <PaymentFailed
          amount={Number(sendAmount || '0')}
          recipient={sendRecipient.name}
          onPrimary={() => setScreen('send-recipient')}
          onSecondary={goHome}
        />
      )}
      {resultState === 'pending' && (
        <PaymentPending
          amount={Number(sendAmount || '0')}
          recipient={sendRecipient.name}
          reference={SAMPLE_REFERENCE}
          onPrimary={() => setScreen('send-review')}
          onSecondary={goHome}
        />
      )}
    </View>
  );

  const renderReceive = () => (
    <View style={styles.stack}>
      <View style={styles.qrCard}>
        <AppText variant="title2">Your wallet</AppText>
        <View style={[styles.qrWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.qrInner}>
            <View style={styles.qrGrid}>
              {Array.from({ length: QR_SIZE * QR_SIZE }, (_, index) => {
                const row = Math.floor(index / QR_SIZE);
                const column = index % QR_SIZE;
                const finderCell = isQrFinderCell(row, column);
                const filled = finderCell ?? ((row * 7 + column * 11 + row * column) % 5 < 2);

                return (
                  <View
                    key={index}
                    style={[
                      styles.qrCell,
                      { backgroundColor: filled ? '#14231F' : 'transparent' },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        </View>
        <AppText variant="caption" color={colors.textTertiary} align="center">
          QR preview · not active yet
        </AppText>
        <View style={[styles.idRow, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
          <AppIcon name="phone" size={16} color={colors.primary} />
          <AppText variant="bodyStrong" color={colors.primary}>
            +255 754 112 843
          </AppText>
        </View>
      </View>

      <View style={styles.inlineActions}>
        <Button label="Copy" variant="secondary" onPress={() => undefined} />
        <Button label="Share" variant="secondary" onPress={() => undefined} />
      </View>

      <View style={[styles.infoContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText variant="bodySmallStrong">Optional details</AppText>
        <View style={styles.inputInline}>
          <AppText variant="bodySmall" color={colors.textSecondary}>Amount</AppText>
          <AppText variant="bodyStrong">{formatMoney(50000, 'TZS')}</AppText>
        </View>
        <View style={styles.inputInline}>
          <AppText variant="bodySmall" color={colors.textSecondary}>Note</AppText>
          <AppText variant="bodyStrong">For house rent</AppText>
        </View>
      </View>
    </View>
  );

  const renderRequestRecipient = () => (
    <View style={styles.stack}>
      <RecipientSelector
        title="Request from"
        value={phone}
        onPhoneChange={setPhone}
        recipients={PAYMENT_RECIPIENTS}
        selectedId={requestRecipientId}
        onSelect={(recipient) => { setRequestRecipientId(recipient.id); setPhone(recipient.phone); }}
      />
      <Button label="Continue" onPress={() => setScreen('request-amount')} />
    </View>
  );

  const renderRequestAmount = () => (
    <View style={styles.stack}>
      <AmountInput
        value={requestAmount}
        onChangeText={setRequestAmount}
        note={requestNote}
        onNoteChange={setRequestNote}
        title="Request amount"
        subtitle="Message"
      />
      <Button label="Continue" onPress={() => setScreen('request-review')} />
    </View>
  );

  const renderRequestReview = () => (
    <PaymentReview
      title="Review request"
      subtitle="Share this with the payer."
      rows={requestRows}
      primaryLabel="Send request"
      secondaryLabel="Edit"
      onPrimary={() => setScreen('request-result')}
      onSecondary={() => setScreen('request-amount')}
    />
  );

  const renderRequestResult = () => (
    <View style={styles.stack}>
      <PaymentStatus state="pending" label="Request sent" />
      <View style={[styles.infoContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText variant="title1">Request details</AppText>
        <View style={styles.inputInline}>
          <AppText variant="bodySmall" color={colors.textSecondary}>Requested from</AppText>
          <AppText variant="bodyStrong">{requestRecipient.name}</AppText>
        </View>
        <View style={styles.inputInline}>
          <AppText variant="bodySmall" color={colors.textSecondary}>Amount</AppText>
          <AppText variant="bodyStrong">{formatMoney(Number(requestAmount || '0'), 'TZS')}</AppText>
        </View>
        <View style={styles.inputInline}>
          <AppText variant="bodySmall" color={colors.textSecondary}>Reference</AppText>
          <AppText variant="bodyStrong">{SAMPLE_REFERENCE}</AppText>
        </View>
        <View style={styles.inputInline}>
          <AppText variant="bodySmall" color={colors.textSecondary}>Date / time</AppText>
          <AppText variant="bodyStrong">Today, 09:20</AppText>
        </View>
      </View>
      <Button label="Done" onPress={goHome} />
    </View>
  );

  const renderPayMerchant = () => (
    <View style={styles.stack}>
      <View style={[styles.merchantCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.merchantAvatar, { backgroundColor: merchant.avatarTone }]}>
          <AppText variant="bodyStrong" color={colors.text}>{merchant.name.slice(0, 1).toUpperCase()}</AppText>
        </View>
        <View style={styles.contactCopy}>
          <AppText variant="title3">{merchant.name}</AppText>
          <AppText variant="bodySmall" color={colors.textSecondary}>{merchant.identifier}</AppText>
          <AppText variant="bodySmall" color={colors.textTertiary}>{merchant.category}</AppText>
        </View>
      </View>
      <PaymentMethodSelector
        methods={PAYMENT_METHOD_TYPES}
        selectedId={payMethodId}
        onSelect={(method: PaymentMethod) => setPayMethodId(method.id)}
      />
      <Button label="Continue" onPress={() => setScreen('pay-amount')} />
    </View>
  );

  const renderPayAmount = () => (
    <View style={styles.stack}>
      <AmountInput
        value={payAmount}
        onChangeText={setPayAmount}
        note={payNote}
        onNoteChange={setPayNote}
        title="Pay amount"
        subtitle="Optional note"
      />
      <Button label="Continue" onPress={() => setScreen('pay-review')} />
    </View>
  );

  const renderPayReview = () => (
    <PaymentReview
      title="Review payment"
      subtitle="Please confirm the merchant details."
      rows={payTransactionRow}
      primaryLabel="Confirm"
      secondaryLabel="Edit"
      onPrimary={() => setScreen('pay-result')}
      onSecondary={() => setScreen('pay-amount')}
    />
  );

  const renderPayResult = () => (
    <View style={styles.stack}>
      <View style={styles.resultTabs}>
        {(['success', 'failed', 'pending'] as ResultState[]).map((state) => (
          <Pressable
            key={state}
            onPress={() => setResultState(state)}
            style={({ pressed }) => [
              styles.tabPill,
              {
                backgroundColor: resultState === state ? colors.primarySoft : colors.surface,
                borderColor: resultState === state ? colors.primary : colors.border,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <AppText variant="bodySmallStrong" color={resultState === state ? colors.primary : colors.textSecondary}>
              {state.charAt(0).toUpperCase() + state.slice(1)}
            </AppText>
          </Pressable>
        ))}
      </View>

      {resultState === 'success' && (
        <PaymentSuccess
          amount={Number(payAmount || '0')}
          recipient={merchant.name}
          reference={SAMPLE_REFERENCE}
          dateTime="Today, 16:05"
          onPrimary={() => setScreen('receipt')}
          onSecondary={goHome}
        />
      )}
      {resultState === 'failed' && (
        <PaymentFailed
          amount={Number(payAmount || '0')}
          recipient={merchant.name}
          onPrimary={() => setScreen('pay-merchant')}
          onSecondary={goHome}
        />
      )}
      {resultState === 'pending' && (
        <PaymentPending
          amount={Number(payAmount || '0')}
          recipient={merchant.name}
          reference={SAMPLE_REFERENCE}
          onPrimary={() => setScreen('pay-review')}
          onSecondary={goHome}
        />
      )}
    </View>
  );

  const renderReceipt = () => (
    <ReceiptDetails
      kind="Transfer"
      amount={Number(sendAmount || '0')}
      sender="You"
      recipient={sendRecipient.name}
      dateTime="Today, 13:42"
      reference={SAMPLE_RECEIPT_REFERENCE}
      paymentMethod={selectedPayMethod.name}
      fee={fee}
      total={total}
    />
  );

  const getHeaderConfig = () => {
    switch (activeScreen) {
      case 'send-recipient':
        return { title: 'Send money', step: 'Recipient', icon: 'send' as const };
      case 'send-amount':
        return { title: 'Send money', step: 'Amount', icon: 'send' as const };
      case 'send-review':
        return { title: 'Send money', step: 'Review', icon: 'send' as const };
      case 'send-result':
        return { title: 'Send money', step: 'Result', icon: 'send' as const };
      case 'receive':
        return { title: 'Receive money', step: 'QR', icon: 'receive' as const };
      case 'request-recipient':
        return { title: 'Request money', step: 'Recipient', icon: 'request' as const };
      case 'request-amount':
        return { title: 'Request money', step: 'Amount', icon: 'request' as const };
      case 'request-review':
        return { title: 'Request money', step: 'Review', icon: 'request' as const };
      case 'request-result':
        return { title: 'Request money', step: 'Result', icon: 'request' as const };
      case 'pay-merchant':
        return { title: 'Pay', step: 'Merchant', icon: 'pay' as const };
      case 'pay-amount':
        return { title: 'Pay', step: 'Amount', icon: 'pay' as const };
      case 'pay-review':
        return { title: 'Pay', step: 'Review', icon: 'pay' as const };
      case 'pay-result':
        return { title: 'Pay', step: 'Result', icon: 'pay' as const };
      case 'receipt':
        return { title: 'Receipt', step: 'Confirmation', icon: 'receipt' as const };
      default:
        return { title: 'Payments', step: 'Overview', icon: 'payments' as const };
    }
  };

  const headerConfig = getHeaderConfig();

  const content = (() => {
    switch (activeScreen) {
      case 'send-recipient':
        return renderSendRecipient();
      case 'send-amount':
        return renderSendAmount();
      case 'send-review':
        return renderSendReview();
      case 'send-result':
        return renderSendResult();
      case 'receive':
        return renderReceive();
      case 'request-recipient':
        return renderRequestRecipient();
      case 'request-amount':
        return renderRequestAmount();
      case 'request-review':
        return renderRequestReview();
      case 'request-result':
        return renderRequestResult();
      case 'pay-merchant':
        return renderPayMerchant();
      case 'pay-amount':
        return renderPayAmount();
      case 'pay-review':
        return renderPayReview();
      case 'pay-result':
        return renderPayResult();
      case 'receipt':
        return renderReceipt();
      default:
        return renderOverview();
    }
  })();

  return (
    <ScreenContainer
      header={
        <View style={[styles.safeHeader, { paddingHorizontal: 16, paddingTop: 12 }]}>
          {activeScreen !== 'overview' ? (
            <FlowHeader
              title={headerConfig.title}
              step={headerConfig.step}
              icon={headerConfig.icon}
              onBack={() => {
                if (activeScreen === 'receipt') setScreen('send-result');
                else if (activeScreen === 'send-result') setScreen('send-review');
                else if (activeScreen === 'send-review') setScreen('send-amount');
                else if (activeScreen === 'send-amount') setScreen('send-recipient');
                else if (activeScreen === 'send-recipient') {
                  if (startFlow === 'send') router.replace('/(tabs)/wallet-tab');
                  else goHome();
                } else if (activeScreen === 'receive') {
                  if (startFlow === 'receive') router.replace('/(tabs)/wallet-tab');
                  else goHome();
                }
                else if (activeScreen === 'request-result') setScreen('request-review');
                else if (activeScreen === 'request-review') setScreen('request-amount');
                else if (activeScreen === 'request-amount') setScreen('request-recipient');
                else if (activeScreen === 'request-recipient') goHome();
                else if (activeScreen === 'pay-result') setScreen('pay-review');
                else if (activeScreen === 'pay-review') setScreen('pay-amount');
                else if (activeScreen === 'pay-amount') setScreen('pay-merchant');
                else if (activeScreen === 'pay-merchant') goHome();
                else setScreen('overview');
              }}
            />
          ) : (
            <View style={styles.overviewHeader}>
              <AppText variant="title2">Payments</AppText>
              <View style={[styles.headerBadge, { backgroundColor: colors.primarySoft }]}>
                <AppIcon name="wallet" size={16} color={colors.primary} />
              </View>
            </View>
          )}
        </View>
      }
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
      bottomInset={18}
    >
      {content}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  sectionTitleWrap: {
    gap: 4,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeHeader: {
    width: '100%',
  },
  resultTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tabPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCard: {
    gap: 14,
  },
  qrWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
  },
  qrInner: {
    width: 220,
    height: 220,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrGrid: {
    width: 162,
    height: 162,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    alignContent: 'flex-start',
    justifyContent: 'flex-start',
    gap: 3,
  },
  qrCell: {
    width: 8,
    height: 8,
    borderRadius: 1,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: 12,
  },
  infoContainer: {
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  inputInline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
  },
  merchantAvatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCopy: {
    flex: 1,
    gap: 2,
  },
});
