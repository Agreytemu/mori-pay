import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import {
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  PinBoxes,
  ProfileField,
  StatusBanner,
} from '@/components/profile/profile-components';
import { AppDialog } from '@/components/ui/app-dialog';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppIllustration } from '@/components/ui/AppIllustration';
import { AppText } from '@/components/ui/AppText';
import { Button, PrimaryButton, SecondaryButton } from '@/components/ui/button';
import {
  MOBILE_NETWORKS,
  MOBILE_NETWORK_LABEL,
  type MobileNetwork,
  type Transaction,
} from '@mori-pay/contracts';

import { ApiError } from '@/lib/api';
import { IdempotencyKeyCache } from '@/lib/idempotency';
import {
  createWithdrawal,
  getTransaction,
  topupCard,
  topupCardPreview,
  topupMobileMoney,
  topupMobileMoneyPreview,
  withdrawalLookup,
  withdrawalPreview,
} from '@/lib/mori-api';
import { normalizeTzPhone } from '@/lib/phone';
import { useSession } from '@/lib/session';
import { useAppTheme } from '@/theme';
import { typography } from '@/theme/typography';
import { formatAmount, formatDateTime } from '@/utils/format';

type WalletOperation = 'deposit' | 'withdraw';
type FeePreviewMethod = 'mobile' | 'card' | 'withdraw';

type Step = 'form' | 'pin' | 'busy' | 'done' | 'pending' | 'failed';

const MIN_AMOUNT = 500;
const MAX_DEPOSIT_AMOUNT = 3_000_000;

const DEPOSIT_METHODS = [
  { id: 'mobile', name: 'Mobile money', description: 'M-Pesa, Airtel Money and more', icon: 'receive' as const },
  { id: 'card', name: 'Debit / credit card', description: 'Visa or Mastercard', icon: 'payments' as const },
];

export function WalletOperationScreen({ operation }: { operation: WalletOperation }) {
  const router = useRouter();
  const { colors, space, radius } = useAppTheme();
  const { setWallet } = useSession();

  const isDeposit = operation === 'deposit';
  const title = isDeposit ? 'Deposit' : 'Withdraw';

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'mobile' | 'card'>('mobile');
  const [mobileNumber, setMobileNumber] = useState('');
  const [network, setNetwork] = useState<MobileNetwork>('Mpesa');
  const [entry, setEntry] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultTransaction, setResultTransaction] = useState<Transaction | null>(null);
  const [lookup, setLookup] = useState<{
    phone: string;
    found: boolean;
    phoneNumber?: string;
    name?: string;
  } | null>(null);
  const [preview, setPreview] = useState<{
    forAmount: number;
    forMethod: FeePreviewMethod;
    amount: number;
    fee: number;
    feePercentage: number;
    total: number;
  } | null>(null);
  const [previewError, setPreviewError] = useState<{
    forAmount: number;
    forMethod: FeePreviewMethod;
    message: string;
  } | null>(null);
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idempotencyKeys = useRef(new IdempotencyKeyCache());

  const numericAmount = Number(amount || '0');
  const amountValid = numericAmount >= MIN_AMOUNT;
  const depositAmountOverLimit =
    isDeposit && numericAmount > MAX_DEPOSIT_AMOUNT;
  const normalizedPhone = normalizeTzPhone(mobileNumber);
  const activeLookup =
    lookup && normalizedPhone && lookup.phone === normalizedPhone ? lookup : null;
  const previewMethod: FeePreviewMethod = isDeposit ? method : 'withdraw';
  const activePreview =
    preview &&
    preview.forAmount === numericAmount &&
    preview.forMethod === previewMethod
      ? preview
      : null;
  const needsFeePreview =
    amountValid &&
    !depositAmountOverLimit;
  const activePreviewError =
    previewError?.forAmount === numericAmount &&
    previewError.forMethod === previewMethod
      ? previewError.message
      : null;

  /* ------------------------------------------------------- withdraw: lookup + fee */

  const refreshWallet = useCallback(async () => {
    try {
      const { getWallet } = await import('@/lib/mori-api');
      setWallet(await getWallet());
    } catch {
      // Best effort; the caller can still navigate.
    }
  }, [setWallet]);

  useEffect(() => {
    if (isDeposit) return;

    const normalized = normalizeTzPhone(mobileNumber);
    if (!normalized) return;

    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    lookupTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const result = await withdrawalLookup(normalized);
          setLookup({ phone: normalized, ...result });
        } catch {
          setLookup({ phone: normalized, found: false });
        }
      })();
    }, 400);

    return () => {
      if (lookupTimer.current) clearTimeout(lookupTimer.current);
    };
  }, [mobileNumber, isDeposit]);

  useEffect(() => {
    if (
      !amountValid ||
      depositAmountOverLimit
    ) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = isDeposit
            ? previewMethod === 'card'
              ? await topupCardPreview(numericAmount)
              : await topupMobileMoneyPreview(numericAmount)
            : await withdrawalPreview(numericAmount);
          if (!cancelled) {
            setPreview({ forAmount: numericAmount, forMethod: previewMethod, ...result });
            setPreviewError(null);
            setError(null);
          }
        } catch (err) {
          if (!cancelled) {
            setPreview(null);
            setPreviewError({
              forAmount: numericAmount,
              forMethod: previewMethod,
              message:
                err instanceof ApiError
                  ? err.message
                  : 'Could not calculate the fee. Please try again.',
            });
          }
        }
      })();
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    isDeposit,
    previewMethod,
    amountValid,
    depositAmountOverLimit,
    numericAmount,
    previewAttempt,
  ]);

  /* ------------------------------------------------------------- deposit: poll */

  const pollUntilSettled = useCallback(
    async (
      transaction: Transaction,
      attempts = 20,
    ): Promise<{ status: 'completed' | 'failed' | 'timeout'; transaction: Transaction }> => {
      let latest = transaction;
      for (let i = 0; i < attempts; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        try {
          latest = await getTransaction(transaction.id);
          if (latest.status === 'completed' || latest.status === 'failed') {
            return { status: latest.status, transaction: latest };
          }
        } catch {
          // Transient read error; keep polling.
        }
      }
      return { status: 'timeout', transaction: latest };
    },
    []
  );

  const runCardDeposit = useCallback(
    async (value: number) => {
      const intent = `card-deposit:${value}`;
      const result = await topupCard({
        amount: value,
        expectedFee: activePreview?.fee,
        idempotencyKey: idempotencyKeys.current.get(intent, 'card-deposit'),
      });
      await WebBrowser.openBrowserAsync(result.checkoutUrl);
      const outcome = await pollUntilSettled(result.transaction);
      setResultTransaction(outcome.transaction);
      if (outcome.status === 'completed') {
        idempotencyKeys.current.clear(intent);
        await refreshWallet();
        setStep('done');
        setResultMessage('Your card payment was received.');
      } else if (outcome.status === 'failed') {
        idempotencyKeys.current.clear(intent);
        setStep('failed');
        setError('The card payment failed. No money left your card.');
      } else {
        setStep('pending');
        setResultMessage(
          'Your payment is still processing. It will appear in your wallet once confirmed.'
        );
      }
    },
    [activePreview?.fee, pollUntilSettled, refreshWallet]
  );

  const runMobileDeposit = useCallback(
    async (value: number) => {
      const normalized = normalizeTzPhone(mobileNumber);
      if (!normalized) throw new Error('Enter a valid mobile money number.');
      const intent = `mobile-deposit:${value}:${normalized}:${network}`;
      const result = await topupMobileMoney({
        amount: value,
        mobileNumber: normalized,
        network,
        expectedFee: activePreview?.fee,
        idempotencyKey: idempotencyKeys.current.get(intent, 'mobile-deposit'),
      });
      setDialog({ title: 'Check your phone', message: result.instructions });
      const outcome = await pollUntilSettled(result.transaction);
      setDialog(null);
      setResultTransaction(outcome.transaction);
      if (outcome.status === 'completed') {
        idempotencyKeys.current.clear(intent);
        await refreshWallet();
        setStep('done');
        setResultMessage('Deposit received.');
      } else if (outcome.status === 'failed') {
        idempotencyKeys.current.clear(intent);
        setStep('failed');
        setError('The deposit failed or was cancelled.');
      } else {
        setStep('pending');
        setResultMessage('Still processing. It will show in your wallet once confirmed.');
      }
    },
    [activePreview?.fee, mobileNumber, network, pollUntilSettled, refreshWallet]
  );

  /* --------------------------------------------------------------- withdraw */

  const submitWithdrawal = useCallback(
    async (value: number, pinValue: string) => {
      const normalized = normalizeTzPhone(mobileNumber);
      if (!normalized) throw new Error('Enter a valid payout number.');
      const intent = `withdrawal:${value}:${normalized}:${network}`;
      const result = await createWithdrawal({
        amount: value,
        phoneNumber: normalized,
        network,
        pin: pinValue,
        expectedFee: activePreview?.fee,
        idempotencyKey: idempotencyKeys.current.get(intent, 'withdrawal'),
      });
      await refreshWallet();
      const outcome =
        result.transaction.status === 'pending'
          ? await pollUntilSettled(result.transaction)
          : { status: result.transaction.status, transaction: result.transaction };
      setResultTransaction(outcome.transaction);
      if (outcome.status === 'completed') {
        idempotencyKeys.current.clear(intent);
        setStep('done');
        setResultMessage('Your withdrawal was confirmed.');
      } else if (outcome.status === 'failed') {
        idempotencyKeys.current.clear(intent);
        setStep('failed');
        setError('The withdrawal failed. Your wallet balance will reflect the final status.');
      } else {
        setStep('pending');
        setResultMessage('Your withdrawal is processing. We will update its status when confirmed.');
      }
    },
    [activePreview?.fee, mobileNumber, network, pollUntilSettled, refreshWallet]
  );

  /* ---------------------------------------------------------------- handlers */

  const continueFlow = async () => {
    setError(null);

    if (!amountValid) {
      setError(`Minimum amount is ${formatAmount(MIN_AMOUNT)}.`);
      return;
    }

    if (depositAmountOverLimit) {
      setError(`Maximum deposit is ${formatAmount(MAX_DEPOSIT_AMOUNT)}.`);
      return;
    }

    if (isDeposit) {
      if (!activePreview) {
        if (activePreviewError) {
          setPreviewError(null);
          setPreviewAttempt((attempt) => attempt + 1);
        } else {
          setError('Wait for the deposit fee and total to load before continuing.');
        }
        return;
      }
      setStep('busy');
      setBusy(true);
      try {
        if (method === 'card') await runCardDeposit(numericAmount);
        else await runMobileDeposit(numericAmount);
      } catch (err) {
        setStep('form');
        if (err instanceof ApiError && err.status === 409) {
          setPreview(null);
          setPreviewAttempt((attempt) => attempt + 1);
        }
        setError(err instanceof ApiError ? err.message : 'Deposit failed. Please try again.');
      } finally {
        setBusy(false);
        setDialog((current) => (current ? current : null));
      }
      return;
    }

    const normalized = normalizeTzPhone(mobileNumber);
    if (!normalized) {
      setError('Enter a valid payout number.');
      return;
    }
    if (!activePreview) {
      if (activePreviewError) {
        setPreviewError(null);
        setPreviewAttempt((attempt) => attempt + 1);
      } else {
        setError('Wait for the withdrawal fee and total to load before continuing.');
      }
      return;
    }
    Keyboard.dismiss();
    setStep('pin');
    setEntry('');
  };

  const onPinChange = (next: string) => {
    if (busy) return;
    setEntry(next);
    if (next.length === 6) void confirmWithPin(next);
  };

  const confirmWithPin = async (pinValue: string) => {
    setBusy(true);
    setError(null);
    try {
      await submitWithdrawal(numericAmount, pinValue);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setStep('form');
        setPreview(null);
        setPreviewAttempt((attempt) => attempt + 1);
        setError(err.message);
      } else {
        setStep('pin');
        setError(err instanceof ApiError ? err.message : 'Withdrawal failed. Please try again.');
      }
      setEntry('');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    idempotencyKeys.current.clearAll();
    setStep('form');
    setAmount('');
    setEntry('');
    setError(null);
    setResultMessage(null);
    setResultTransaction(null);
    setPreview(null);
    setPreviewError(null);
    setLookup(null);
  };

  const accountHint = useMemo(() => isDeposit ? 'Funds settle into your Mori Pay wallet.' : 'Cash out to mobile money.', [isDeposit]);

  /* ------------------------------------------------------------------ render */

  if (step === 'done' || step === 'pending' || step === 'failed') {
    const success = step === 'done';
    const pending = step === 'pending';
    const receiptText = resultTransaction
      ? [
          `Mori Pay ${title} ${success ? 'receipt' : 'status'}`,
          `Status: ${success ? 'Successful' : pending ? 'Processing' : 'Failed'}`,
          `Amount: ${formatAmount(resultTransaction.amount)}`,
          `Fee: ${formatAmount(resultTransaction.fee)}`,
          `Total: ${formatAmount(resultTransaction.amount + resultTransaction.fee)}`,
          `Counterparty: ${resultTransaction.counterparty}`,
          `Channel: ${resultTransaction.channel}`,
          `Reference: ${resultTransaction.reference}`,
          `Transaction ID: ${resultTransaction.id}`,
          `Date: ${formatDateTime(resultTransaction.createdAt)}`,
        ].join('\n')
      : '';
    const shareReceipt = async () => {
      try {
        await Share.share({ message: receiptText });
      } catch {
        setDialog({ title: 'Could not share', message: 'Please try again.' });
      }
    };
    const copyReceipt = async () => {
      try {
        await Clipboard.setStringAsync(receiptText);
        setDialog({ title: 'Copied', message: 'Receipt details copied to clipboard.' });
      } catch {
        setDialog({ title: 'Could not copy', message: 'Please try again.' });
      }
    };
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <ScrollView contentContainerStyle={styles.resultWrap}>
          {success ? <AppIllustration name="moneyReceived" width={188} height={132} /> : null}
          <View
            style={[
              styles.resultIcon,
              {
                borderRadius: radius.circle,
                backgroundColor: success
                  ? colors.successSoft
                  : pending
                    ? colors.warningSoft
                    : colors.errorSoft,
              },
            ]}>
            <AppIcon
              name={success ? 'success' : pending ? 'pending' : 'warning'}
              size={34}
              color={success ? colors.success : pending ? colors.warning : colors.error}
              weight="semibold"
            />
          </View>
          <AppText variant="title2" align="center">
            {success ? `${title} complete` : pending ? `${title} processing` : `${title} failed`}
          </AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} align="center">
            {success || pending ? resultMessage : error}
          </AppText>
          {resultTransaction ? (
            <View
              style={[
                styles.receiptCard,
                {
                  borderRadius: radius.lg,
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}>
              <View style={styles.receiptRow}>
                <AppText variant="bodySmall" color={colors.textSecondary}>Amount</AppText>
                <AppText variant="bodySmallStrong" numeric>{formatAmount(resultTransaction.amount)}</AppText>
              </View>
              <View style={styles.receiptRow}>
                <AppText variant="bodySmall" color={colors.textSecondary}>Fee</AppText>
                <AppText variant="bodySmallStrong" numeric>{formatAmount(resultTransaction.fee)}</AppText>
              </View>
              <View style={styles.receiptRow}>
                <AppText variant="bodySmall" color={colors.textSecondary}>Total debited</AppText>
                <AppText variant="bodySmallStrong" numeric>
                  {formatAmount(resultTransaction.amount + resultTransaction.fee)}
                </AppText>
              </View>
              <View style={styles.receiptRow}>
                <AppText variant="bodySmall" color={colors.textSecondary}>Counterparty</AppText>
                <AppText variant="bodySmallStrong" numberOfLines={2}>{resultTransaction.counterparty}</AppText>
              </View>
              <View style={styles.receiptRow}>
                <AppText variant="bodySmall" color={colors.textSecondary}>Reference</AppText>
                <AppText variant="bodySmallStrong" numberOfLines={1}>{resultTransaction.reference}</AppText>
              </View>
              <View style={styles.receiptRow}>
                <AppText variant="bodySmall" color={colors.textSecondary}>Transaction ID</AppText>
                <AppText variant="bodySmallStrong" numberOfLines={1}>{resultTransaction.id}</AppText>
              </View>
              <View style={styles.receiptRow}>
                <AppText variant="bodySmall" color={colors.textSecondary}>Date</AppText>
                <AppText variant="bodySmallStrong">{formatDateTime(resultTransaction.createdAt)}</AppText>
              </View>
            </View>
          ) : null}
          <View style={styles.resultActions}>
            {resultTransaction ? (
              <>
                <PrimaryButton label="Share receipt details" block onPress={() => void shareReceipt()} />
                <SecondaryButton label="Copy receipt details" block onPress={() => void copyReceipt()} />
              </>
            ) : null}
            <PrimaryButton label="Done" block onPress={() => router.back()} />
            {!success && !pending ? <SecondaryButton label="Try again" block onPress={reset} /> : null}
          </View>
        </ScrollView>
        <AppDialog
          visible={dialog !== null}
          title={dialog?.title ?? ''}
          message={dialog?.message ?? ''}
          onClose={() => setDialog(null)}
          testID="wallet-operation-dialog"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: space.base }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Wallet"
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            { borderRadius: radius.circle, backgroundColor: pressed ? colors.surfacePressed : colors.surface, borderColor: colors.border },
          ]}>
          <AppIcon name="chevronLeft" size={19} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <AppText variant="title2">{title}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>Wallet</AppText>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingHorizontal: space.base, paddingTop: space.lg, paddingBottom: space.xl, gap: space.lg },
          ]}
          showsVerticalScrollIndicator={false}>
          {isDeposit ? <AppIllustration name="addingFunds" width={204} height={136} /> : null}
          <View style={styles.amountBlock}>
            <AppText variant="bodySmall" color={colors.textSecondary}>
              {isDeposit ? 'Amount to add' : 'Amount to withdraw'}
            </AppText>
            <View style={styles.amountRow}>
              <AppText variant="bodyStrong" color={colors.textSecondary}>TZS</AppText>
              <TextInput
                accessibilityLabel={isDeposit ? 'Amount to add' : 'Amount to withdraw'}
                value={amount}
                onChangeText={(value) => setAmount(value.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                returnKeyType="done"
                selectionColor={colors.primary}
                style={[styles.amountInput, { color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textTertiary}
              />
            </View>
            <AppText variant="caption" color={colors.textTertiary}>
              {isDeposit
                ? `${formatAmount(MIN_AMOUNT)} - ${formatAmount(MAX_DEPOSIT_AMOUNT)}.`
                : `Minimum ${formatAmount(MIN_AMOUNT)}.`}
            </AppText>
          </View>

          {isDeposit ? (
            <View style={styles.methods}>
              <AppText variant="bodySmallStrong">Payment method</AppText>
              {DEPOSIT_METHODS.map((item) => {
                const selected = item.id === method;
                return (
                  <Pressable
                    key={item.id}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => setMethod(item.id as 'mobile' | 'card')}
                    style={({ pressed }) => [
                      styles.methodRow,
                      {
                        backgroundColor: pressed ? colors.surfacePressed : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                        borderWidth: selected ? 1.5 : 1,
                        borderRadius: radius.md,
                        padding: space.base,
                      },
                    ]}>
                    <View style={[styles.methodIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
                      <AppIcon name={item.icon} size={20} color={colors.primary} />
                    </View>
                    <View style={styles.methodCopy}>
                      <AppText variant="bodySmallStrong">{item.name}</AppText>
                      <AppText variant="caption" color={colors.textSecondary}>{item.description}</AppText>
                    </View>
                    {selected ? <AppIcon name="check" size={18} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {!isDeposit || method === 'mobile' ? (
            <View style={styles.fields}>
              <ProfileField
                label={isDeposit ? 'Mobile money number' : 'Payout number'}
                value={mobileNumber}
                onChangeText={(value) => setMobileNumber(value)}
                keyboardType="phone-pad"
                autoComplete="tel"
                placeholder="0712 345 678"
                hint={
                  isDeposit
                    ? 'We will prompt this number for payment.'
                    : 'Double-check the number — payouts cannot be reversed.'
                }
              />

              <View style={styles.networks}>
                <AppText variant="bodySmallStrong">Network</AppText>
                <View style={styles.networkRow}>
                  {MOBILE_NETWORKS.map((net) => {
                    const selected = net === network;
                    return (
                      <Pressable
                        key={net}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        onPress={() => setNetwork(net)}
                        style={({ pressed }) => [
                          styles.chip,
                          {
                            borderRadius: radius.pill,
                            backgroundColor: selected ? colors.primarySoft : pressed ? colors.surfacePressed : colors.surface,
                            borderColor: selected ? colors.primary : colors.border,
                          },
                        ]}>
                        <AppText variant="caption" color={selected ? colors.primary : colors.textSecondary}>
                          {MOBILE_NETWORK_LABEL[net]}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
                <AppText variant="caption" color={colors.textTertiary}>
                  Abliner routes the correct rail automatically; this is a hint only.
                </AppText>
              </View>

              {!isDeposit && activeLookup?.found && activeLookup.name ? (
                <StatusBanner tone="success" title={`Sending to ${activeLookup.name}`} message={activeLookup.phoneNumber} />
              ) : null}

              {activeLookup && !activeLookup.found ? (
                <StatusBanner
                  tone="info"
                  title="Name not confirmed"
                  message="We could not verify the registered name. Check the number before continuing."
                />
              ) : null}

            </View>
          ) : (
            <View style={[styles.accountHint, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}>
              <AppIcon name="payments" size={17} color={colors.textSecondary} />
              <AppText variant="caption" color={colors.textSecondary} style={styles.hintText}>
                You will be redirected to a secure card checkout, then returned to the app.
              </AppText>
            </View>
          )}

          {activePreview ? (
            <View style={[styles.feeCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md }]}>
              <View style={styles.feeRow}>
                <AppText variant="bodySmall" color={colors.textSecondary}>
                  {isDeposit ? 'Wallet credit' : 'Amount'}
                </AppText>
                <AppText variant="bodySmallStrong" numeric>{formatAmount(activePreview.amount)}</AppText>
              </View>
              <View style={styles.feeRow}>
                <AppText variant="bodySmall" color={colors.textSecondary}>
                  {activePreview.feePercentage > 0
                    ? `Fee (${Number((activePreview.feePercentage * 100).toFixed(2))}%)`
                    : 'Fee'}
                </AppText>
                <AppText variant="bodySmallStrong" numeric>{formatAmount(activePreview.fee)}</AppText>
              </View>
              {!isDeposit ? (
                <View style={styles.feeRow}>
                  <AppText variant="bodySmallStrong">You receive</AppText>
                  <AppText variant="title3" numeric>{formatAmount(activePreview.amount)}</AppText>
                </View>
              ) : null}
              <View style={styles.feeRow}>
                <AppText variant="bodySmall" color={colors.textSecondary}>
                  {isDeposit ? 'Total to pay' : 'Total debited'}
                </AppText>
                <AppText variant="bodySmallStrong" numeric>{formatAmount(activePreview.total)}</AppText>
              </View>
              {isDeposit ? (
                <AppText variant="caption" color={colors.textTertiary}>
                  Review the checkout page for any additional card-provider charges.
                </AppText>
              ) : null}
            </View>
          ) : null}
          {needsFeePreview && !activePreview && !activePreviewError ? (
            <AppText variant="caption" color={colors.textSecondary}>Calculating fee and total…</AppText>
          ) : null}
          {needsFeePreview && activePreviewError ? (
            <StatusBanner tone="error" title="Could not calculate fee" message={activePreviewError} />
          ) : null}

          {error ? <StatusBanner tone="error" title="Something went wrong" message={error} onDismiss={() => setError(null)} /> : null}

          {step === 'form' ? (
            <Button
              label="Continue"
              loading={busy}
              disabled={needsFeePreview && !activePreview && !activePreviewError}
              onPress={() => void continueFlow()}
            />
          ) : null}

          <AppText variant="caption" color={colors.textTertiary}>{accountHint}</AppText>
        </ScrollView>

        {step === 'pin' ? (
          <View style={[styles.pinSheet, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <AppText variant="bodySmallStrong" align="center">Enter your PIN to confirm</AppText>
            <PinBoxes
              key={step}
              value={entry}
              onChangeText={onPinChange}
              autoFocus
              editable={!busy}
            />
            {error ? <StatusBanner tone="error" title="PIN rejected" message={error} onDismiss={() => setError(null)} /> : null}
            <SecondaryButton label="Cancel" block disabled={busy} onPress={() => { setStep('form'); setEntry(''); setError(null); }} />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <AppDialog
        visible={dialog !== null}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        onClose={() => setDialog(null)}
        testID="wallet-operation-dialog"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingTop: 8 },
  backButton: { width: 42, height: 42, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: 1 },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  amountBlock: { gap: 10 },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  amountInput: { flex: 1, minWidth: 0, width: 0, ...typography.amountInputLarge, paddingVertical: 0, minHeight: 52 },
  methods: { gap: 10 },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  methodIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  methodCopy: { flex: 1, gap: 2 },
  fields: { gap: 16 },
  networks: { gap: 8 },
  networkRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  feeCard: { borderWidth: 1, padding: 14, gap: 8 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accountHint: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  hintText: { flex: 1 },
  pinSheet: { borderTopWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  resultWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  resultIcon: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  resultActions: { width: '100%', gap: 10, marginTop: 8 },
  receiptCard: { width: '100%', maxWidth: 560, borderWidth: 1, padding: 16, gap: 12 },
  receiptRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
});
