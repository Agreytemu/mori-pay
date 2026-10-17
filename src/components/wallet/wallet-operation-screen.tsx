import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
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
import { SegmentedSpinner } from '@/components/ui/SegmentedSpinner';
import { Button, PrimaryButton, SecondaryButton } from '@/components/ui/button';
import { reloadNotifications } from '@/data/notification-store';
import {
  mobileNetworkDisplayName,
  resolveMobileNetwork,
  type MobileNetwork,
  type Transaction,
} from '@mori-pay/contracts';

import { ApiError } from '@/lib/api';
import { IdempotencyKeyCache } from '@/lib/idempotency';
import {
  loadPaymentMethods,
  usePaymentMethods,
} from '@/data/payment-method-store';
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
import { getTzPhoneInputDigits, normalizeTzPhone } from '@/lib/phone';
import { notifyTransactionCompleted } from '@/lib/transaction-feedback';
import { useSession } from '@/lib/session';
import { useAppTheme } from '@/theme';
import { typography } from '@/theme/typography';
import { formatAmount, formatDateTime } from '@/utils/format';
import { getTransactionOutcomeReason } from '@/utils/transaction-outcome';

type WalletOperation = 'deposit' | 'withdraw';
type FeePreviewMethod = 'mobile' | 'card' | 'withdraw';

type Step = 'form' | 'pin' | 'busy' | 'done' | 'pending' | 'failed';

function isDefinitiveProviderFailure(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.code === 'PROVIDER_ERROR' &&
    error.details?.retryable === false
  );
}

function getUserFacingError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  switch (error.code) {
    case 'PROVIDER_ERROR':
      return 'The payment service is temporarily unavailable. Check transaction status before trying again.';
    case 'UNAUTHORIZED':
      return 'Your session expired. Sign in again to continue.';
    case 'FORBIDDEN':
      return 'The transaction could not be authorized. Check your PIN and try again.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a moment before trying again.';
    case 'CONFLICT':
      return 'The transaction details changed. Review the latest fee and total before continuing.';
    default:
      return fallback;
  }
}

const MIN_AMOUNT = 500;
const MAX_DEPOSIT_AMOUNT = 3_000_000;

const MOBILE_NETWORK_LOGOS: Record<MobileNetwork, number> = {
  Mpesa: require('../../../assets/images/M-PESA logo vector (svg, pdf) free download - Brandlogos_net.jpg'),
  AirtelMoney: require('../../../assets/images/airtellmoney.jpg'),
  TigoPesa: require('../../../assets/images/mixx by yas.jpg'),
  HaloPesa: require('../../../assets/images/halopesa.jpg'),
};

const DEPOSIT_METHODS = [
  { id: 'mobile', name: 'Mobile money', description: 'M-Pesa, Airtel Money and more', icon: 'receive' as const },
  { id: 'card', name: 'Debit / credit card', description: 'Visa or Mastercard', icon: 'payments' as const },
];

export function WalletOperationScreen({ operation }: { operation: WalletOperation }) {
  const router = useRouter();
  const { colors, space, radius } = useAppTheme();
  const { setWallet, user } = useSession();
  const {
    methods: savedPaymentMethods,
    loading: savedPaymentMethodsLoading,
    error: savedPaymentMethodsError,
  } = usePaymentMethods();
  const savedMobileMethods = useMemo(
    () =>
      savedPaymentMethods.filter(
        (savedMethod) =>
          savedMethod.kind === 'mobile-money' &&
          savedMethod.status === 'Active' &&
          savedMethod.usableForDeposit,
      ),
    [savedPaymentMethods],
  );
  const savedMobileMethodsNeedingUpdate = useMemo(
    () =>
      savedPaymentMethods.filter(
        (savedMethod) =>
          savedMethod.kind === 'mobile-money' &&
          savedMethod.status === 'Active' &&
          !savedMethod.usableForDeposit,
      ),
    [savedPaymentMethods],
  );

  const isDeposit = operation === 'deposit';
  const title = isDeposit ? 'Deposit' : 'Withdraw';

  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'mobile' | 'card'>('mobile');
  const [mobilePaymentSource, setMobilePaymentSource] = useState<'saved' | 'custom'>('custom');
  const [savedMobileMethodId, setSavedMobileMethodId] = useState<string | null>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [entry, setEntry] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [resultTransaction, setResultTransaction] = useState<Transaction | null>(null);
  const [statusCheckAttempt, setStatusCheckAttempt] = useState(0);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [lookup, setLookup] = useState<{
    phone: string;
    found: boolean;
    phoneNumber?: string;
    name?: string;
    network?: string;
  } | null>(null);
  const [preview, setPreview] = useState<{
    forAmount: number;
    forMethod: FeePreviewMethod;
    amount: number;
    fee: number;
    feePercentage: number;
    total: number;
    providerAvailable?: boolean;
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
  const submissionLock = useRef(false);

  useFocusEffect(
    useCallback(() => {
      void loadPaymentMethods(undefined, { force: true });
    }, [])
  );

  const numericAmount = Number(amount || '0');
  const amountValid = numericAmount >= MIN_AMOUNT;
  const depositAmountOverLimit =
    isDeposit && numericAmount > MAX_DEPOSIT_AMOUNT;
  const normalizedPhone = normalizeTzPhone(mobileNumber);
  const activeLookup =
    lookup && normalizedPhone && lookup.phone === normalizedPhone ? lookup : null;
  const needsNumberLookup =
    (!isDeposit || method === 'mobile' && mobilePaymentSource === 'custom') &&
    Boolean(normalizedPhone) &&
    !activeLookup;
  const usingSavedMobileMethod = useMemo(
    () =>
      isDeposit &&
      method === 'mobile' &&
      mobilePaymentSource === 'saved' &&
      savedMobileMethods.some((savedMethod) => savedMethod.id === savedMobileMethodId),
    [isDeposit, method, mobilePaymentSource, savedMobileMethodId, savedMobileMethods],
  );
  const showCustomLookup = !isDeposit || mobilePaymentSource === 'custom';
  const detectedNetwork = resolveMobileNetwork(activeLookup?.network);
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
  const requiresNumberVerification = !isDeposit || method === 'mobile';
  const numberVerified =
    usingSavedMobileMethod ||
    !requiresNumberVerification ||
    activeLookup?.found === true;
  const canContinue =
    amountValid &&
    !depositAmountOverLimit &&
    Boolean(activePreview) &&
    numberVerified &&
    (isDeposit || activePreview?.providerAvailable === true);
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

  const announceCompletedTransaction = useCallback((transaction: Transaction) => {
    if (transaction.status !== 'completed') return;
    void notifyTransactionCompleted(transaction.id);
    void reloadNotifications(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    if (
      isDeposit &&
      (method === 'card' || mobilePaymentSource === 'saved')
    ) return;

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
  }, [mobileNumber, isDeposit, method, mobilePaymentSource]);

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
                getUserFacingError(err, 'Could not calculate the fee. Please try again.'),
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
      attempts = 40,
    ): Promise<{ status: 'completed' | 'failed' | 'cancelled' | 'timeout'; transaction: Transaction }> => {
      let latest = transaction;
      for (let i = 0; i < attempts; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        try {
          latest = await getTransaction(transaction.id);
          if (
            latest.status === 'completed' ||
            latest.status === 'failed' ||
            latest.status === 'cancelled'
          ) {
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

  const resultTransactionId = resultTransaction?.id;

  useEffect(() => {
    if (step !== 'pending' || !resultTransactionId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const latest = await getTransaction(resultTransactionId);
        if (!active) return;
        setResultTransaction(latest);
        if (latest.status === 'completed') {
          announceCompletedTransaction(latest);
          setResultMessage(isDeposit ? 'Deposit received.' : 'Your withdrawal was confirmed.');
          setStep('done');
          await refreshWallet();
          return;
        }
        if (latest.status === 'failed' || latest.status === 'cancelled') {
          setError(
            getTransactionOutcomeReason(latest),
          );
          setStep('failed');
          await refreshWallet();
          return;
        }
      } catch {
        // A failed status read is not evidence that the transaction failed.
      }
      attempts += 1;
      if (active && attempts < 10) {
        timer = setTimeout(() => void checkStatus(), 3_000);
      } else if (active) {
        setCheckingStatus(false);
        setResultMessage(
          'Your transaction is still awaiting confirmation. Check its status again later; do not start another payment.',
        );
      }
    };

    timer = setTimeout(() => void checkStatus(), 1_500);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [
    step,
    resultTransactionId,
    isDeposit,
    refreshWallet,
    announceCompletedTransaction,
    statusCheckAttempt,
  ]);

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
        announceCompletedTransaction(outcome.transaction);
        idempotencyKeys.current.clear(intent);
        await refreshWallet();
        setStep('done');
        setResultMessage('Your card payment was received.');
      } else if (outcome.status === 'cancelled') {
        idempotencyKeys.current.clear(intent);
        setStep('failed');
        setError(getTransactionOutcomeReason(outcome.transaction));
      } else if (outcome.status === 'failed') {
        idempotencyKeys.current.clear(intent);
        setStep('failed');
        setError(getTransactionOutcomeReason(outcome.transaction));
      } else {
        setCheckingStatus(true);
        setStep('pending');
        setResultMessage(
          'Your payment is still processing. It will appear in your wallet once confirmed.'
        );
      }
    },
    [activePreview?.fee, announceCompletedTransaction, pollUntilSettled, refreshWallet, setError, setResultMessage, setResultTransaction, setStep]
  );

  const runMobileDeposit = useCallback(
    async (value: number) => {
      const normalized = normalizeTzPhone(mobileNumber);
      if (usingSavedMobileMethod && !savedMobileMethodId) {
        throw new Error('Choose a saved mobile-money method.');
      }
      if (!usingSavedMobileMethod && !normalized) {
        throw new Error('Enter a valid mobile money number.');
      }
      const intent = usingSavedMobileMethod
        ? `mobile-deposit:${value}:saved:${savedMobileMethodId}`
        : `mobile-deposit:${value}:${normalized}`;
      const paymentMethodInput = usingSavedMobileMethod
        ? savedMobileMethodId
          ? { savedPaymentMethodId: savedMobileMethodId }
          : null
        : normalized
          ? { mobileNumber: normalized, network: activeLookup?.network }
          : null;
      if (!paymentMethodInput) throw new Error('Enter a valid mobile money number.');
      const result = await topupMobileMoney({
        amount: value,
        ...paymentMethodInput,
        expectedFee: activePreview?.fee,
        idempotencyKey: idempotencyKeys.current.get(intent, 'mobile-deposit'),
      });
      setResultMessage(result.instructions);
      const outcome = await pollUntilSettled(result.transaction);
      setResultTransaction(outcome.transaction);
      if (outcome.status === 'completed') {
        announceCompletedTransaction(outcome.transaction);
        idempotencyKeys.current.clear(intent);
        await refreshWallet();
        setStep('done');
        setResultMessage('Deposit received.');
      } else if (outcome.status === 'cancelled') {
        idempotencyKeys.current.clear(intent);
        setStep('failed');
        setError(getTransactionOutcomeReason(outcome.transaction));
      } else if (outcome.status === 'failed') {
        idempotencyKeys.current.clear(intent);
        setStep('failed');
        setError(getTransactionOutcomeReason(outcome.transaction));
      } else {
        setCheckingStatus(true);
        setStep('pending');
        setResultMessage('Still processing. It will show in your wallet once confirmed.');
      }
    },
    [
      activeLookup?.network,
      activePreview?.fee,
      announceCompletedTransaction,
      mobileNumber,
      pollUntilSettled,
      refreshWallet,
      savedMobileMethodId,
      setError,
      setResultMessage,
      setResultTransaction,
      setStep,
      usingSavedMobileMethod,
    ]
  );

  /* --------------------------------------------------------------- withdraw */

  const submitWithdrawal = useCallback(
    async (value: number, pinValue: string) => {
      const normalized = normalizeTzPhone(mobileNumber);
      if (!normalized) throw new Error('Enter a valid payout number.');
      const intent = `withdrawal:${value}:${normalized}`;
      const result = await createWithdrawal({
        amount: value,
        phoneNumber: normalized,
        network: activeLookup?.network,
        pin: pinValue,
        expectedFee: activePreview?.fee,
        idempotencyKey: idempotencyKeys.current.get(intent, 'withdrawal'),
      });
      await refreshWallet();
      const settled =
        result.transaction.status === 'completed' ||
        result.transaction.status === 'failed' ||
        result.transaction.status === 'cancelled';
      const outcome = settled
        ? { status: result.transaction.status, transaction: result.transaction }
        : await pollUntilSettled(result.transaction);
      setResultTransaction(outcome.transaction);
      if (outcome.status === 'completed') {
        announceCompletedTransaction(outcome.transaction);
        idempotencyKeys.current.clear(intent);
        setStep('done');
        setResultMessage('Your withdrawal was confirmed.');
      } else if (outcome.status === 'cancelled') {
        idempotencyKeys.current.clear(intent);
        setStep('failed');
        setError(getTransactionOutcomeReason(outcome.transaction));
      } else if (outcome.status === 'failed') {
        idempotencyKeys.current.clear(intent);
        setStep('failed');
        setError(getTransactionOutcomeReason(outcome.transaction));
      } else {
        setCheckingStatus(true);
        setStep('pending');
        setResultMessage('Your withdrawal is processing. We will update its status when confirmed.');
      }
    },
    [
      activeLookup?.network,
      activePreview?.fee,
      announceCompletedTransaction,
      mobileNumber,
      pollUntilSettled,
      refreshWallet,
      setError,
      setResultTransaction,
      setStep,
      setResultMessage,
    ]
  );

  /* ---------------------------------------------------------------- handlers */

  const continueFlow = async () => {
    setError(null);
    setResultMessage(null);
    setResultTransaction(null);

    if (!amountValid) {
      setError(`Minimum amount is ${formatAmount(MIN_AMOUNT)}.`);
      return;
    }

    if (depositAmountOverLimit) {
      setError(`Maximum deposit is ${formatAmount(MAX_DEPOSIT_AMOUNT)}.`);
      return;
    }

    if (isDeposit) {
      if (submissionLock.current) return;
      if (method === 'mobile' && !usingSavedMobileMethod && !activeLookup) {
        setError('Wait for the mobile number lookup to finish before continuing.');
        return;
      }
      if (!activePreview) {
        if (activePreviewError) {
          setPreviewError(null);
          setPreviewAttempt((attempt) => attempt + 1);
        } else {
          setError('Wait for the deposit fee and total to load before continuing.');
        }
        return;
      }
      submissionLock.current = true;
      setStep('busy');
      setBusy(true);
      try {
        if (method === 'card') await runCardDeposit(numericAmount);
        else await runMobileDeposit(numericAmount);
      } catch (err) {
        const providerUnavailable = isDefinitiveProviderFailure(err);
        setStep(providerUnavailable ? 'failed' : 'form');
        if (providerUnavailable) setResultTransaction(null);
        if (err instanceof ApiError && err.status === 409) {
          setPreview(null);
          setPreviewAttempt((attempt) => attempt + 1);
        }
        setError(getUserFacingError(err, 'Deposit failed. Please try again.'));
      } finally {
        submissionLock.current = false;
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
    if (!activeLookup) {
      setError('Wait for the mobile number lookup to finish before continuing.');
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
    if (submissionLock.current) return;
    submissionLock.current = true;
    setBusy(true);
    setStep('busy');
    setError(null);
    try {
      await submitWithdrawal(numericAmount, pinValue);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setStep('form');
        setPreview(null);
        setPreviewAttempt((attempt) => attempt + 1);
        setError('The transaction details changed. Review the latest fee and total before continuing.');
      } else if (isDefinitiveProviderFailure(err)) {
        setStep('failed');
        setResultTransaction(null);
        setError(getUserFacingError(err, 'Withdrawal failed. Please try again.'));
      } else {
        setStep('pin');
        setError(getUserFacingError(err, 'Withdrawal failed. Please try again.'));
      }
      setEntry('');
    } finally {
      submissionLock.current = false;
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
    const cancelled = resultTransaction?.status === 'cancelled';
    const finalStatus = success
      ? 'Successful'
      : pending
        ? 'Processing'
        : cancelled
          ? 'Cancelled'
          : 'Failed';
    const outcomeReason = resultTransaction
      ? getTransactionOutcomeReason(resultTransaction)
      : null;
    const receiptText = resultTransaction
      ? [
          `Mori Pay ${title} ${success ? 'receipt' : 'status'}`,
          `Status: ${finalStatus}`,
          ...(outcomeReason ? [`Reason: ${outcomeReason}`] : []),
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
          <Image
            source={require('../../../assets/images/mori pay official logo.png')}
            contentFit="contain"
            accessibilityLabel="Mori Pay"
            style={styles.brandLogo}
          />
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
          {pending && checkingStatus ? (
            <SegmentedSpinner size={22} label="Checking transaction status" />
          ) : null}
          <AppText variant="title2" align="center">
            {success
              ? `${title} complete`
              : pending
                ? `${title} processing`
                : cancelled
                  ? `${title} cancelled`
                  : `${title} not completed`}
          </AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} align="center">
            {success || pending ? resultMessage : outcomeReason ?? error}
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
              {outcomeReason ? (
                <View style={styles.receiptRow}>
                  <AppText variant="bodySmall" color={colors.textSecondary}>Reason</AppText>
                  <AppText variant="bodySmallStrong" style={styles.reasonText}>
                    {outcomeReason}
                  </AppText>
                </View>
              ) : null}
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
          {pending && !checkingStatus ? (
            <SecondaryButton
              label="Check transaction status"
              block
              onPress={() => {
                setCheckingStatus(true);
                setResultMessage('Checking the latest transaction status…');
                setStatusCheckAttempt((attempt) => attempt + 1);
              }}
            />
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

  if (step === 'busy') {
    return (
      <SafeAreaView
        style={[styles.safeArea, styles.busyScreen, { backgroundColor: colors.background }]}
        edges={['top']}>
        <Image
          source={require('../../../assets/images/mori pay official logo.png')}
          contentFit="contain"
          accessibilityLabel="Mori Pay"
          style={styles.brandLogo}
        />
        <View style={[styles.loadingOrbit, { borderColor: colors.primary }]}>
          <SegmentedSpinner size={68} label={isDeposit ? 'Processing deposit' : 'Processing withdrawal'} />
        </View>
        <AppText variant="title2" align="center">
          {isDeposit ? 'Confirming your deposit' : 'Processing your withdrawal'}
        </AppText>
        <AppText variant="bodySmall" color={colors.textSecondary} align="center">
          {resultMessage || (isDeposit && method === 'mobile'
            ? 'Approve the payment request on your phone. We will show the final result here.'
            : 'Please wait while we confirm the transaction. Do not submit it again.')}
        </AppText>
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
              {isDeposit ? (
                <View style={styles.methods}>
                  <AppText variant="bodySmallStrong">Mobile-money number</AppText>
                  {savedMobileMethods.length ? (
                    <Pressable
                      accessibilityRole="radio"
                      accessibilityState={{ checked: mobilePaymentSource === 'saved' }}
                      onPress={() => setMobilePaymentSource('saved')}
                      style={({ pressed }) => [
                        styles.methodRow,
                        {
                          backgroundColor: pressed ? colors.surfacePressed : colors.surface,
                          borderColor: mobilePaymentSource === 'saved' ? colors.primary : colors.border,
                          borderWidth: mobilePaymentSource === 'saved' ? 1.5 : 1,
                          borderRadius: radius.md,
                          padding: space.base,
                        },
                      ]}>
                      <View style={[styles.methodIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
                        <AppIcon name="phone" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.methodCopy}>
                        <AppText variant="bodySmallStrong">Use a saved payment method</AppText>
                        <AppText variant="caption" color={colors.textSecondary}>
                          Choose a saved mobile-money number
                        </AppText>
                      </View>
                      {mobilePaymentSource === 'saved' ? <AppIcon name="check" size={18} color={colors.primary} /> : null}
                    </Pressable>
                  ) : null}
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: mobilePaymentSource === 'custom' }}
                    onPress={() => setMobilePaymentSource('custom')}
                    style={({ pressed }) => [
                      styles.methodRow,
                      {
                        backgroundColor: pressed ? colors.surfacePressed : colors.surface,
                        borderColor: mobilePaymentSource === 'custom' ? colors.primary : colors.border,
                        borderWidth: mobilePaymentSource === 'custom' ? 1.5 : 1,
                        borderRadius: radius.md,
                        padding: space.base,
                      },
                    ]}>
                    <View style={[styles.methodIcon, { backgroundColor: colors.primarySoft, borderRadius: radius.md }]}>
                      <AppIcon name="phone" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.methodCopy}>
                      <AppText variant="bodySmallStrong">Use a different number</AppText>
                      <AppText variant="caption" color={colors.textSecondary}>
                        Enter a mobile-money number for this deposit
                      </AppText>
                    </View>
                    {mobilePaymentSource === 'custom' ? <AppIcon name="check" size={18} color={colors.primary} /> : null}
                  </Pressable>
                  {savedPaymentMethodsLoading ? (
                    <AppText variant="caption" color={colors.textSecondary}>Loading saved payment methods…</AppText>
                  ) : savedPaymentMethodsError ? (
                    <View style={styles.noSavedMethods}>
                      <StatusBanner
                        tone="error"
                        title="Could not load saved payment methods"
                        message="Check your connection and try again."
                      />
                      <SecondaryButton
                        label="Try again"
                        size="sm"
                        onPress={() => void loadPaymentMethods(undefined, { force: true })}
                      />
                    </View>
                  ) : savedMobileMethods.length ? (
                    mobilePaymentSource === 'saved' ? (
                      <View style={styles.savedMethods}>
                        {savedMobileMethods.map((savedMethod) => {
                          const selected = savedMethod.id === savedMobileMethodId;
                          return (
                            <Pressable
                              key={savedMethod.id}
                              accessibilityRole="radio"
                              accessibilityState={{ checked: selected }}
                              accessibilityLabel={`${savedMethod.provider} ending in ${savedMethod.identifier.slice(-4)}`}
                              onPress={() => setSavedMobileMethodId(savedMethod.id)}
                              style={({ pressed }) => [
                                styles.savedMethod,
                                {
                                  backgroundColor: pressed ? colors.surfacePressed : colors.surface,
                                  borderColor: selected ? colors.primary : colors.border,
                                  borderWidth: selected ? 1.5 : 1,
                                  borderRadius: radius.md,
                                },
                              ]}>
                              <AppText variant="bodySmallStrong">{savedMethod.provider}</AppText>
                              <AppText variant="bodySmall" color={colors.textSecondary}>
                                {savedMethod.identifier}
                              </AppText>
                              {selected ? <AppIcon name="check" size={18} color={colors.primary} /> : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null
                  ) : (
                    <View style={[styles.noSavedMethods, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}>
                      <AppText variant="bodySmallStrong">
                        {savedMobileMethodsNeedingUpdate.length
                          ? 'Saved mobile-money numbers need re-adding'
                          : 'No usable saved mobile-money methods'}
                      </AppText>
                      <AppText variant="caption" color={colors.textSecondary}>
                        {savedMobileMethodsNeedingUpdate.length
                          ? 'These numbers were saved without their full phone number, so they cannot be used for deposits yet. Remove the saved method and add it again with the full number.'
                          : 'Add a mobile-money number to use it for future deposits, or enter a different number below.'}
                      </AppText>
                      <SecondaryButton
                        label={savedMobileMethodsNeedingUpdate.length ? 'Manage saved methods' : 'Add payment method'}
                        size="sm"
                        onPress={() =>
                          router.push(
                            savedMobileMethodsNeedingUpdate.length
                              ? '/payment-methods'
                              : '/payment-methods/add',
                          )
                        }
                      />
                    </View>
                  )}
                </View>
              ) : null}

              {!isDeposit || mobilePaymentSource === 'custom' ? (
                <ProfileField
                  label={isDeposit ? 'Mobile money number' : 'Payout number'}
                  value={mobileNumber}
                  onChangeText={(value) => setMobileNumber(getTzPhoneInputDigits(value))}
                  floatingLabel={false}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  placeholder="712 345 678"
                  leadingContent={
                    <View style={styles.phonePrefix} accessible accessibilityLabel="Tanzania, country code plus 255">
                      <AppText variant="bodySmall">🇹🇿</AppText>
                      <AppText variant="bodySmallStrong" color={colors.textSecondary}>+255</AppText>
                    </View>
                  }
                  hint={
                    isDeposit
                      ? 'We will prompt this number for payment.'
                      : 'Double-check the number — payouts cannot be reversed.'
                  }
                />
              ) : null}

              {showCustomLookup && needsNumberLookup ? (
                <View
                  accessible
                  accessibilityLabel="Verifying phone number"
                  style={[styles.lookupLoading, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}>
                  <SegmentedSpinner size={20} label="Checking the mobile-money number" />
                  <AppText variant="caption" color={colors.textSecondary}>
                    Verifying number…
                  </AppText>
                </View>
              ) : null}

              {showCustomLookup && activeLookup?.found ? (
                <View
                  accessibilityRole="summary"
                  style={[
                    styles.networkLookupCard,
                    {
                      borderRadius: radius.md,
                      backgroundColor: colors.successSoft,
                      borderColor: colors.successBorder,
                    },
                  ]}>
                  {detectedNetwork ? (
                    <View
                      style={[
                        styles.networkLogoTile,
                        {
                          borderRadius: radius.sm,
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                        },
                      ]}>
                      <Image
                        source={MOBILE_NETWORK_LOGOS[detectedNetwork]}
                        contentFit="contain"
                        accessibilityLabel={`${mobileNetworkDisplayName(activeLookup.network)} logo`}
                        style={styles.networkLogo}
                      />
                    </View>
                  ) : null}
                  <View style={styles.networkLookupCopy}>
                    <AppText variant="bodySmallStrong" color={colors.success}>
                      {activeLookup.name ? `Number verified: ${activeLookup.name}` : 'Mobile number verified'}
                    </AppText>
                    <AppText variant="caption" color={colors.textSecondary}>
                      {activeLookup.phoneNumber}
                    </AppText>
                    {activeLookup.network ? (
                      <AppText variant="caption" color={colors.textSecondary}>
                        {mobileNetworkDisplayName(activeLookup.network)}
                      </AppText>
                    ) : null}
                  </View>
                  <AppIcon name="success" size={18} color={colors.success} weight="semibold" />
                </View>
              ) : null}

              {showCustomLookup && activeLookup && !activeLookup.found ? (
                <StatusBanner
                  tone="info"
                  title="Network not identified"
                  message="We could not confirm this number's network. Check the number; your payment may still be routed automatically."
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
          {!isDeposit && activePreview?.providerAvailable === false ? (
            <View style={styles.previewRetry}>
              <StatusBanner
                tone="error"
                title="Withdrawal method unavailable"
                message="Mobile withdrawals are temporarily unavailable. Please check again."
              />
              <SecondaryButton
                label="Check availability again"
                size="sm"
                onPress={() => {
                  setPreview(null);
                  setPreviewAttempt((attempt) => attempt + 1);
                }}
              />
            </View>
          ) : null}
          {needsFeePreview && !activePreview && !activePreviewError ? (
            <View
              accessible
              accessibilityLabel={!isDeposit ? 'Checking recipient and withdrawal fee' : 'Calculating fee and total'}
              style={[styles.lookupLoading, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}>
              <SegmentedSpinner size={20} label="Calculating the fee" />
              <AppText variant="caption" color={colors.textSecondary}>
                {!isDeposit
                  ? 'Checking recipient, withdrawal fee and availability…'
                  : 'Calculating fee and total…'}
              </AppText>
            </View>
          ) : null}
          {needsFeePreview && activePreviewError ? (
            <View style={styles.previewRetry}>
              <StatusBanner tone="error" title="Could not calculate fee" message={activePreviewError} />
              <SecondaryButton
                label="Retry fee calculation"
                size="sm"
                onPress={() => {
                  setPreviewError(null);
                  setPreviewAttempt((attempt) => attempt + 1);
                }}
              />
            </View>
          ) : null}

          {error ? <StatusBanner tone="error" title="Something went wrong" message={error} onDismiss={() => setError(null)} /> : null}

          {step === 'form' ? (
            <Button
              label="Continue"
              variant={canContinue ? 'primary' : 'secondary'}
              disabled={!canContinue}
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
  savedMethods: { gap: 8 },
  savedMethod: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  noSavedMethods: { gap: 8, padding: 12 },
  phonePrefix: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lookupLoading: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  networkLookupCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    padding: 10,
  },
  networkLogoTile: {
    width: 64,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
  },
  networkLogo: {
    width: '100%',
    height: '100%',
  },
  networkLookupCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  feeCard: { borderWidth: 1, padding: 14, gap: 8 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  accountHint: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  hintText: { flex: 1 },
  pinSheet: { borderTopWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  resultWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  busyScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 28 },
  brandLogo: { width: 112, height: 92 },
  loadingOrbit: {
    width: 92,
    height: 92,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIcon: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  resultActions: { width: '100%', gap: 10, marginTop: 8 },
  receiptCard: { width: '100%', maxWidth: 560, borderWidth: 1, padding: 16, gap: 12 },
  receiptRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  reasonText: { flex: 1, textAlign: 'right' },
  previewRetry: { gap: 8 },
});
