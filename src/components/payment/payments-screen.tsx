import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useNavigation, useRouter, type Href } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { BackHandler, Keyboard, Pressable, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AmountInput,
  FlowHeader,
  FlowOverviewCard,
  PaymentFailed,
  PaymentPending,
  PaymentReview,
  PaymentStatus,
  PaymentSuccess,
  ReceiptDetails,
  type DetailRow,
} from '@/components/payment/payment-components';
import {
  PinBoxes,
  ProfileField,
  StatusBanner,
} from '@/components/profile/profile-components';
import { PhoneField } from '@/components/ui/PhoneField';
import { QRCodeScanner } from '@/components/payment/QRCodeScanner';
import { AppDialog } from '@/components/ui/app-dialog';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppIllustration, type AppIllustrationName } from '@/components/ui/AppIllustration';
import { AppText } from '@/components/ui/AppText';
import { Button, SecondaryButton } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/EmptyState';
import { SegmentedSpinner } from '@/components/ui/SegmentedSpinner';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { PAYMENT_FLOW_ROUTES, type PaymentFlow } from '@/constants/payment-routes';
import type {
  MoneyRequest,
  MerchantPaymentPreview,
  MerchantQrPreview,
  PayMerchantQrResult,
  PayMerchantResult,
  ReceiveCode,
  RecipientLookup,
  RequestMoneyResult,
  SendMoneyResult,
  TransferPreview,
} from '@mori-pay/contracts';

import { ApiError } from '@/lib/api';
import { IdempotencyKeyCache } from '@/lib/idempotency';
import {
  createRequest,
  getReceiveCode,
  getWallet,
  listMerchants,
  lookupRecipient,
  payMerchant,
  payMerchantQr,
  previewMerchantPayment,
  previewMerchantQr,
  previewTransfer,
  sendMoney,
  verifyReceiveCode,
} from '@/lib/mori-api';
import { getTzPhoneInputDigits, normalizeTzPhone, prettyTzPhone } from '@/lib/phone';
import { useSession } from '@/lib/session';
import { notifyTransactionCompleted } from '@/lib/transaction-feedback';
import { useAsync } from '@/lib/use-async';
import { useAppTheme } from '@/theme';
import { reloadNotifications } from '@/data/notification-store';
import { formatDateTime } from '@/utils/format';
import { formatMoney } from '@/utils/format-money';

type FlowName =
  | 'overview'
  | 'send-recipient'
  | 'send-amount'
  | 'send-review'
  | 'send-result'
  | 'send-receipt'
  | 'receive'
  | 'request-recipient'
  | 'request-amount'
  | 'request-review'
  | 'request-result'
  | 'merchant'
  | 'pay-amount'
  | 'pay-review'
  | 'pay-result'
  | 'qr-scan'
  | 'qr-amount'
  | 'qr-review'
  | 'qr-result';

type PinReason = 'send' | 'pay' | 'qr';

export const MIN_AMOUNT = 500;

function prettyPhone(phone: string): string {
  return prettyTzPhone(phone);
}

function transactionErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  switch (error.code) {
    case 'PROVIDER_ERROR':
      return 'The payment service is temporarily unavailable. Check the transaction status before trying again.';
    case 'UNAUTHORIZED':
      return 'Your session expired. Sign in again to continue.';
    case 'FORBIDDEN':
      return 'The transaction could not be authorized. Check your PIN and try again.';
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a moment before trying again.';
    case 'CONFLICT':
      return 'The transaction details changed. Review the latest details before trying again.';
    default:
      return fallback;
  }
}

function initialScreenForFlow(flow?: PaymentFlow): FlowName {
  switch (flow) {
    case 'send':
      return 'send-recipient';
    case 'receive':
      return 'receive';
    case 'request':
      return 'request-recipient';
    case 'pay':
      return 'merchant';
    default:
      return 'overview';
  }
}

export function PaymentsScreen({ initialFlow }: { initialFlow?: PaymentFlow }) {
  const { colors, radius, space } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const session = useSession();

  const [screen, setScreen] = useState<FlowName>(() => initialScreenForFlow(initialFlow));
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);

  /* Send money */
  const [sendPhone, setSendPhone] = useState('');
  const [sendPhoneNorm, setSendPhoneNorm] = useState<string | null>(null);
  const [scanningSendCode, setScanningSendCode] = useState(false);
  const [recipientLookup, setRecipientLookup] = useState<
    (RecipientLookup & { phone: string }) | null
  >(null);
  const [sendAmount, setSendAmount] = useState('');
  const [sendNote, setSendNote] = useState('');
  const [transferPreview, setTransferPreview] = useState<TransferPreview | null>(null);
  const [sendResult, setSendResult] = useState<SendMoneyResult | null>(null);

  /* Request money */
  const [requestPhone, setRequestPhone] = useState('');
  const [requestPhoneNorm, setRequestPhoneNorm] = useState<string | null>(null);
  const [requestLookup, setRequestLookup] = useState<
    (RecipientLookup & { phone: string }) | null
  >(null);
  const [requestAmount, setRequestAmount] = useState('');
  const [requestNote, setRequestNote] = useState('');
  const [requestResult, setRequestResult] = useState<RequestMoneyResult | null>(null);

  /* Pay merchant */
  const [payMerchantId, setPayMerchantId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payPreview, setPayPreview] = useState<MerchantPaymentPreview | null>(null);
  const [payResult, setPayResult] = useState<PayMerchantResult | null>(null);

  /* Customer merchant QR payment */
  const [merchantQrCode, setMerchantQrCode] = useState<string | null>(null);
  const [merchantQrAmount, setMerchantQrAmount] = useState('');
  const [merchantQrAmountRequired, setMerchantQrAmountRequired] = useState(false);
  const [merchantQrPreview, setMerchantQrPreview] = useState<MerchantQrPreview | null>(null);
  const [merchantQrResult, setMerchantQrResult] = useState<PayMerchantQrResult | null>(null);

  /* Receive QR */
  const [receiveCode, setReceiveCode] = useState<ReceiveCode | null>(null);
  const [receiveBusy, setReceiveBusy] = useState(false);
  const [receiveError, setReceiveError] = useState<string | null>(null);

  /* Shared flow state */
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinReason, setPinReason] = useState<PinReason | null>(null);
  const [pinEntry, setPinEntry] = useState('');

  const merchants = useAsync(() => listMerchants(), []);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idempotencyKeys = useRef(new IdempotencyKeyCache());
  const submissionLock = useRef(false);

  const wallet = session.wallet;
  const sendRecipientName =
    recipientLookup && sendPhoneNorm && recipientLookup.phone === sendPhoneNorm
      ? recipientLookup.fullName ?? recipientLookup.firstName
      : undefined;
  const sendRecipientLabel = sendRecipientName
    ? sendRecipientName
    : sendPhoneNorm
      ? prettyPhone(sendPhoneNorm)
      : '';
  const selectedMerchant =
    merchants.data?.find((merchant) => merchant.id === payMerchantId) ?? null;

  const refreshWallet = async () => {
    try {
      session.setWallet(await getWallet());
    } catch {
      // Best effort; the next load will reconcile.
    }
  };

  const loadReceiveCode = useCallback(async () => {
    setReceiveBusy(true);
    setReceiveError(null);
    try {
      setReceiveCode(await getReceiveCode());
    } catch (err) {
      setReceiveError(err instanceof Error ? err.message : 'Could not load your receive code');
    } finally {
      setReceiveBusy(false);
    }
  }, []);

  /* ------------------------------------------------- recipient lookup (send) */

  useEffect(() => {
    const normalized = normalizeTzPhone(sendPhone);
    if (!normalized) return;
    if (sendTimer.current) clearTimeout(sendTimer.current);
    sendTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const lookup = await lookupRecipient(normalized);
          setRecipientLookup({ phone: normalized, ...lookup });
        } catch {
          setRecipientLookup({ phone: normalized, found: false, phoneNumber: normalized });
        }
      })();
    }, 400);
    return () => {
      if (sendTimer.current) clearTimeout(sendTimer.current);
    };
  }, [sendPhone]);

  const activeLookup =
    recipientLookup &&
    (() => {
      const current = normalizeTzPhone(sendPhone);
      return current && recipientLookup.phone === current ? recipientLookup : null;
    })();

  /* ---------------------------------------------- recipient lookup (request) */

  useEffect(() => {
    const normalized = normalizeTzPhone(requestPhone);
    if (!normalized) {
      return;
    }
    if (requestTimer.current) clearTimeout(requestTimer.current);
    requestTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const lookup = await lookupRecipient(normalized);
          setRequestLookup({ phone: normalized, ...lookup });
        } catch {
          setRequestLookup({ phone: normalized, found: false, phoneNumber: normalized });
        }
      })();
    }, 400);
    return () => {
      if (requestTimer.current) clearTimeout(requestTimer.current);
    };
  }, [requestPhone]);

  const requestActiveLookup =
    requestLookup &&
    (() => {
      const current = normalizeTzPhone(requestPhone);
      return current && requestLookup.phone === current ? requestLookup : null;
    })();

  /* ---------------------------------------------------------------- helpers */

  const goHome = useCallback(() => {
    if (initialFlow) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/payments');
    } else {
      setScreen('overview');
    }
  }, [initialFlow, router]);

  const openFlow = useCallback((flow: PaymentFlow) => {
    setError(null);
    router.push(PAYMENT_FLOW_ROUTES[flow]);
  }, [router]);

  const handleBack = useCallback(() => {
    setError(null);
    switch (screen) {
      case 'send-receipt':
        setScreen('send-result');
        break;
      case 'send-result':
        setScreen('send-review');
        break;
      case 'send-review':
        setScreen('send-amount');
        break;
      case 'send-amount':
        setScreen('send-recipient');
        break;
      case 'send-recipient':
      case 'receive':
        goHome();
        break;
      case 'request-review':
        setScreen('request-amount');
        break;
      case 'request-amount':
        setScreen('request-recipient');
        break;
      case 'request-recipient':
      case 'request-result':
        goHome();
        break;
      case 'pay-result':
        setScreen('pay-review');
        break;
      case 'qr-result':
        setScreen('qr-review');
        break;
      case 'qr-review':
        setScreen(merchantQrAmountRequired ? 'qr-amount' : 'merchant');
        break;
      case 'qr-amount':
        setScreen('qr-scan');
        break;
      case 'qr-scan':
        setScreen('merchant');
        break;
      case 'pay-review':
        setScreen('pay-amount');
        break;
      case 'pay-amount':
        setScreen('merchant');
        break;
      case 'merchant':
        goHome();
        break;
      default:
        setScreen('overview');
    }
  }, [goHome, merchantQrAmountRequired, screen]);

  const activeScreen = screen;

  /* -------------------------------------------------------------- receive QR */

  useEffect(() => {
    if (activeScreen !== 'receive') return;
    const timer = setTimeout(() => void loadReceiveCode(), 0);
    return () => clearTimeout(timer);
  }, [activeScreen, loadReceiveCode]);


  /* ---------------------------------------------------------------- handlers */

  const continueSendRecipient = async () => {
    setError(null);
    const normalized = normalizeTzPhone(sendPhone);
    if (!normalized) {
      setError('Enter a valid Tanzanian phone number.');
      return;
    }
    setBusy(true);
    try {
      const lookup = await lookupRecipient(normalized);
      setRecipientLookup({ phone: normalized, ...lookup });
      if (!lookup.found) {
        setError('No Mori Pay account found for that number.');
        setSendPhoneNorm(null);
        return;
      }
      setSendPhoneNorm(normalized);
      setScreen('send-amount');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not look up that number.');
    } finally {
      setBusy(false);
    }
  };

  const resolveSendReceiveCode = async (code: string) => {
    setBusy(true);
    setError(null);
    try {
      const lookup = await verifyReceiveCode(code.trim());
      const normalized = normalizeTzPhone(lookup.phoneNumber);
      if (!lookup.found || !normalized) {
        setError(
          'This receive code is invalid or expired. Ask the recipient to refresh their QR code, then scan it again.',
        );
        setScanningSendCode(false);
        return;
      }

      setSendPhone(getTzPhoneInputDigits(normalized));
      setSendPhoneNorm(normalized);
      setRecipientLookup({ ...lookup, phone: normalized, phoneNumber: normalized });
      setTransferPreview(null);
      setScanningSendCode(false);
      setScreen('send-amount');
    } catch (err) {
      setError(
        err instanceof ApiError && [400, 404, 410, 422].includes(err.status)
          ? 'This receive code is invalid or expired. Ask the recipient to refresh their QR code, then scan it again.'
          : 'Could not verify this receive code. Check your connection and scan again.',
      );
      setScanningSendCode(false);
    } finally {
      setBusy(false);
    }
  };

  const continueSendAmount = async () => {
    setError(null);
    const amount = Number(sendAmount || '0');
    if (amount < MIN_AMOUNT) {
      setError(`Minimum amount is ${formatMoney(MIN_AMOUNT, 'TZS')}.`);
      return;
    }
    if (!sendPhoneNorm) return;
    setBusy(true);
    try {
      const preview = await previewTransfer({ recipientPhone: sendPhoneNorm, amount });
      setTransferPreview(preview);
      setScreen('send-review');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not price the transfer.');
    } finally {
      setBusy(false);
    }
  };

  const submitSend = async (pin: string) => {
    if (!sendPhoneNorm) return;
    if (submissionLock.current) return;
    submissionLock.current = true;
    const amount = Number(sendAmount || '0');
    const note = sendNote.trim();
    const intent = `send:${sendPhoneNorm}:${amount}:${note}`;
    setBusy(true);
    setError(null);
    try {
      const result = await sendMoney({
        recipientPhone: sendPhoneNorm,
        amount,
        note: note || undefined,
        pin,
        idempotencyKey: idempotencyKeys.current.get(intent, 'send'),
      });
      if (
        result.transaction.status === 'completed' ||
        result.transaction.status === 'failed' ||
        result.transaction.status === 'cancelled'
      ) {
        idempotencyKeys.current.clear(intent);
      }
      if (result.transaction.status === 'completed') {
        void notifyTransactionCompleted(result.transaction.id);
        void reloadNotifications(session.user?.id ?? null);
      }
      setSendResult(result);
      setPinReason(null);
      setPinEntry('');
      await refreshWallet();
      setScreen('send-result');
    } catch (err) {
      setPinEntry('');
      setError(transactionErrorMessage(err, 'Transfer could not be confirmed. Check your transaction history before trying again.'));
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  };

  const continueRequestRecipient = async () => {
    setError(null);
    const normalized = normalizeTzPhone(requestPhone);
    if (!normalized) {
      setError('Enter a valid Tanzanian phone number.');
      return;
    }
    setBusy(true);
    try {
      const lookup = await lookupRecipient(normalized);
      setRequestLookup({ phone: normalized, ...lookup });
      if (!lookup.found) {
        setError(
          'No Mori Pay account found for that number. You can only request money from registered Mori Pay users.',
        );
        setRequestPhoneNorm(null);
        return;
      }
      setRequestPhoneNorm(normalized);
      setScreen('request-amount');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not look up that number.');
    } finally {
      setBusy(false);
    }
  };

  const continueRequestAmount = () => {
    setError(null);
    const amount = Number(requestAmount || '0');
    if (amount < MIN_AMOUNT) {
      setError(`Minimum amount is ${formatMoney(MIN_AMOUNT, 'TZS')}.`);
      return;
    }
    setScreen('request-review');
  };

  const submitRequest = async () => {
    if (submissionLock.current) return;
    submissionLock.current = true;
    setError(null);
    if (!requestPhoneNorm) {
      submissionLock.current = false;
      return;
    }
    setBusy(true);
    try {
      const result = await createRequest({
        payerPhone: requestPhoneNorm,
        amount: Number(requestAmount || '0'),
        note: requestNote.trim() || undefined,
      });
      setRequestResult(result);
      setScreen('request-result');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the request.');
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  };

  const continuePayAmount = async () => {
    setError(null);
    const amount = Number(payAmount || '0');
    if (amount < MIN_AMOUNT) {
      setError(`Minimum amount is ${formatMoney(MIN_AMOUNT, 'TZS')}.`);
      return;
    }
    if (!payMerchantId) return;
    setBusy(true);
    setPayPreview(null);
    try {
      setPayPreview(
        await previewMerchantPayment({ merchantId: payMerchantId, amount }),
      );
      setScreen('pay-review');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not calculate the payment fee.');
    } finally {
      setBusy(false);
    }
  };

  const submitPay = async (pin: string) => {
    if (!payMerchantId) return;
    if (submissionLock.current) return;
    submissionLock.current = true;
    const amount = Number(payAmount || '0');
    const note = payNote.trim();
    const intent = `merchant-pay:${payMerchantId}:${amount}:${note}`;
    setBusy(true);
    setError(null);
    try {
      const result = await payMerchant({
        merchantId: payMerchantId,
        amount,
        note: note || undefined,
        pin,
        idempotencyKey: idempotencyKeys.current.get(intent, 'merchant-pay'),
      });
      if (
        result.transaction.status === 'completed' ||
        result.transaction.status === 'failed' ||
        result.transaction.status === 'cancelled'
      ) {
        idempotencyKeys.current.clear(intent);
      }
      if (result.transaction.status === 'completed') {
        void notifyTransactionCompleted(result.transaction.id);
        void reloadNotifications(session.user?.id ?? null);
      }
      setPayResult(result);
      setPinReason(null);
      setPinEntry('');
      await refreshWallet();
      setScreen('pay-result');
    } catch (err) {
      setPinEntry('');
      setError(transactionErrorMessage(err, 'Payment could not be confirmed. Check your transaction history before trying again.'));
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  };

  const resolveMerchantQr = async (code: string) => {
    setBusy(true);
    setError(null);
    setMerchantQrCode(code.trim());
    setMerchantQrAmount('');
    setMerchantQrAmountRequired(false);
    try {
      const preview = await previewMerchantQr({ code: code.trim() });
      setMerchantQrPreview(preview);
      setScreen('qr-review');
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.message.toLowerCase().includes('amount is required')
      ) {
        setMerchantQrAmountRequired(true);
        setScreen('qr-amount');
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not verify this merchant QR code.');
        setScreen('merchant');
      }
    } finally {
      setBusy(false);
    }
  };

  const continueMerchantQrAmount = async () => {
    const amount = Number(merchantQrAmount);
    if (!merchantQrCode || !Number.isSafeInteger(amount) || amount < MIN_AMOUNT) {
      setError(`Enter an amount of at least ${formatMoney(MIN_AMOUNT, 'TZS')}.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const preview = await previewMerchantQr({ code: merchantQrCode, amount });
      setMerchantQrPreview(preview);
      setScreen('qr-review');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify this merchant QR code.');
    } finally {
      setBusy(false);
    }
  };

  const submitMerchantQrPay = async (pin: string) => {
    if (!merchantQrCode || !merchantQrPreview) return;
    if (submissionLock.current) return;
    submissionLock.current = true;
    const intent = `merchant-qr:${merchantQrCode}:${merchantQrPreview.amount}`;
    setBusy(true);
    setError(null);
    try {
      const result = await payMerchantQr({
        code: merchantQrCode,
        amount: merchantQrAmountRequired ? merchantQrPreview.amount : undefined,
        pin,
        idempotencyKey: idempotencyKeys.current.get(intent, 'merchant-qr'),
      });
      if (
        result.transaction.status === 'completed' ||
        result.transaction.status === 'failed' ||
        result.transaction.status === 'cancelled'
      ) {
        idempotencyKeys.current.clear(intent);
      }
      if (result.transaction.status === 'completed') {
        void notifyTransactionCompleted(result.transaction.id);
        void reloadNotifications(session.user?.id ?? null);
      }
      setMerchantQrResult(result);
      setPinReason(null);
      setPinEntry('');
      await refreshWallet();
      setScreen('qr-result');
    } catch (err) {
      setPinEntry('');
      setError(transactionErrorMessage(err, 'Payment could not be confirmed. Check your transaction history before trying again.'));
    } finally {
      submissionLock.current = false;
      setBusy(false);
    }
  };

  const onPinChange = (next: string) => {
    if (busy) return;
    setPinEntry(next);
    if (next.length === 6) {
      if (pinReason === 'send') void submitSend(next);
      else if (pinReason === 'pay') void submitPay(next);
      else if (pinReason === 'qr') void submitMerchantQrPay(next);
    }
  };

  const closePin = useCallback(() => {
    setPinReason(null);
    setPinEntry('');
    setError(null);
  }, []);

  const isFlowStart =
    screen === 'send-recipient' ||
    screen === 'receive' ||
    screen === 'request-recipient' ||
    screen === 'merchant';

  useEffect(
    () =>
      navigation.addListener('beforeRemove', (event) => {
        if (!pinReason && isFlowStart) return;
        event.preventDefault();
        if (pinReason) {
          if (!busy) closePin();
          return;
        }
        handleBack();
      }),
    [navigation, pinReason, isFlowStart, busy, closePin, handleBack]
  );

  useFocusEffect(
    useCallback(() => {
      if (!initialFlow) return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (pinReason) {
          if (!busy) closePin();
          return true;
        }
        if (!isFlowStart) {
          handleBack();
          return true;
        }
        if (!router.canGoBack()) {
          router.replace('/(tabs)/payments');
          return true;
        }
        return false;
      });
      return () => subscription.remove();
    }, [initialFlow, pinReason, busy, isFlowStart, closePin, handleBack, router])
  );

  const copyText = async (label: string, value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setDialog({ title: 'Copied', message: `${label} copied to clipboard.` });
    } catch {
      setDialog({ title: 'Could not copy', message: `Could not copy ${label.toLowerCase()}.` });
    }
  };

  /* ------------------------------------------------------------------ render */

  const renderOverview = () => (
    <View style={styles.stack}>
      <AppIllustration name="payments" width={220} height={142} />
      <View style={styles.overviewIntro}>
        <AppText variant="title2">Move money</AppText>
        <AppText variant="bodySmall" color={colors.textSecondary}>
          Choose how you want to move money.
        </AppText>
      </View>
      <FlowOverviewCard
        title="Send money"
        description="Transfer to a person or family member."
        icon="send"
        onPress={() => openFlow('send')}
        featured
      />
      <View style={styles.moreWaysHeader}>
        <AppText variant="title3">More options</AppText>
        <Button
          label="Request history"
          variant="ghost"
          size="sm"
          icon="chevronRight"
          iconPosition="trailing"
          onPress={() => router.push('/money-requests' as Href)}
        />
      </View>
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

  const renderRecipientStep = ({
    title,
    value,
    onChange,
    hint,
    illustration,
    lookup,
    onContinue,
  }: {
    title: string;
    value: string;
    onChange: (value: string) => void;
    hint: string;
    illustration: AppIllustrationName;
    lookup?: RecipientLookup | null;
    onContinue: () => void;
  }) => (
    <View style={styles.stack}>
      <AppIllustration name={illustration} width={220} height={132} />
      <PhoneField
        label="Phone number"
        value={value}
        onChangeText={onChange}
        hint={hint}
      />
      {lookup && lookup.found ? (
        <StatusBanner
          tone="success"
          title={`Found ${lookup.fullName ?? lookup.firstName ?? 'a Mori Pay account'}`}
          message={prettyPhone(lookup.phoneNumber ?? value)}
        />
      ) : null}
      {lookup && !lookup.found ? (
        <StatusBanner
          tone="info"
          title="Name not found"
          message="That number is not a Mori Pay account yet. Check the number before continuing."
        />
      ) : null}
      {error ? <StatusBanner tone="error" title="Check the details" message={error} onDismiss={() => setError(null)} /> : null}
      <Button label="Continue" loading={busy} onPress={() => void onContinue()} />
      <AppText variant="bodySmall" color={colors.textSecondary}>
        {title}
      </AppText>
    </View>
  );

  const renderSendRecipient = () =>
    scanningSendCode ? (
      <QRCodeScanner
        onScan={(code) => void resolveSendReceiveCode(code)}
        onCancel={() => {
          setScanningSendCode(false);
          setError(null);
        }}
      />
    ) : (
      <>
        {renderRecipientStep({
          title: 'The recipient must have a Mori Pay account to receive the transfer.',
          value: sendPhone,
          onChange: setSendPhone,
          hint: 'We will verify the account owner before you continue.',
          illustration: 'sendMoney',
          lookup: activeLookup,
          onContinue: continueSendRecipient,
        })}
        <SecondaryButton
          label="Scan recipient QR"
          block
          disabled={busy}
          onPress={() => {
            setError(null);
            setScanningSendCode(true);
          }}
        />
      </>
    );

  const renderSendAmount = () => (
    <View style={styles.stack}>
      <AmountInput
        value={sendAmount}
        onChangeText={setSendAmount}
        note={sendNote}
        onNoteChange={setSendNote}
        title={`Send to ${sendRecipientLabel}`}
        subtitle="Optional note"
      />
      {error ? <StatusBanner tone="error" title="Check the amount" message={error} onDismiss={() => setError(null)} /> : null}
      <Button label="Continue" loading={busy} onPress={() => void continueSendAmount()} />
    </View>
  );

  const sendRows: DetailRow[] = [
    { label: 'Recipient', value: sendRecipientLabel },
    { label: 'Amount', value: formatMoney(Number(sendAmount || '0'), 'TZS') },
    {
      label: 'Fee',
      value: transferPreview ? formatMoney(transferPreview.fee, 'TZS') : '…',
      muted: true,
    },
    {
      label: 'Total',
      value: transferPreview ? formatMoney(transferPreview.total, 'TZS') : '…',
    },
    { label: 'Note', value: sendNote || 'No note' },
  ];

  const renderSendReview = () => (
    <PaymentReview
      title="Review transfer"
      subtitle="Check your details before confirming."
      rows={sendRows}
      primaryLabel="Confirm"
      secondaryLabel="Edit"
      onPrimary={() => {
        Keyboard.dismiss();
        setPinReason('send');
      }}
      onSecondary={() => setScreen('send-amount')}
    />
  );

  const renderSendResult = () => {
    if (!sendResult) return <EmptyState icon="transactions" title="…" description="" />;
    const { transaction } = sendResult;
    if (transaction.status === 'pending' || transaction.status === 'processing') {
      return (
        <PaymentPending
          amount={transaction.amount}
          recipient={transaction.counterparty}
          reference={transaction.reference}
          onPrimary={() => router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })}
          onSecondary={goHome}
        />
      );
    }
    if (transaction.status !== 'completed') {
      return renderSendFailed(transaction.status === 'cancelled' ? 'cancelled' : 'failed');
    }
    return (
      <PaymentSuccess
        amount={transaction.amount}
        fee={sendResult.fee}
        total={transaction.amount + sendResult.fee}
        transactionId={transaction.id}
        recipient={transaction.counterparty}
        reference={transaction.reference}
        dateTime={formatDateTime(transaction.createdAt)}
        onPrimary={() => setScreen('send-receipt')}
        onSecondary={goHome}
      />
    );
  };

  const renderSendFailed = (status: 'failed' | 'cancelled' = 'failed') => {
    const amount = Number(sendAmount || '0');
    return (
      <PaymentFailed
        amount={amount}
        recipient={sendRecipientLabel}
        status={status}
        onPrimary={() => setScreen('send-amount')}
        onSecondary={goHome}
      />
    );
  };

  const renderReceipt = () => {
    const result = sendResult ?? payResult;
    if (!result) return null;
    const { transaction } = result;
    const fee = result.fee;
    const recipient = payResult ? payResult.merchantName : transaction.counterparty;
    const receiptText = [
      `Mori Pay ${payResult ? 'payment' : 'transfer'} receipt`,
      'Status: Successful',
      `Amount: ${formatMoney(transaction.amount, 'TZS')}`,
      `Fee: ${formatMoney(fee, 'TZS')}`,
      `Total: ${formatMoney(transaction.amount + fee, 'TZS')}`,
      `Sender: You`,
      `Recipient: ${recipient}`,
      `Payment method: Wallet`,
      `Reference: ${transaction.reference}`,
      `Transaction ID: ${transaction.id}`,
      `Date: ${formatDateTime(transaction.createdAt)}`,
    ].join('\n');
    const shareReceipt = async () => {
      try {
        await Share.share({ message: receiptText });
      } catch {
        setDialog({ title: 'Could not share receipt', message: 'Please try again.' });
      }
    };
    const copyReceipt = async () => {
      try {
        await Clipboard.setStringAsync(receiptText);
        setDialog({ title: 'Receipt copied', message: 'Receipt details copied to clipboard.' });
      } catch {
        setDialog({ title: 'Could not copy receipt', message: 'Please try again.' });
      }
    };
    return (
      <ReceiptDetails
        kind={payResult ? 'Payment' : 'Transfer'}
        amount={transaction.amount}
        sender="You"
        recipient={recipient}
        dateTime={formatDateTime(transaction.createdAt)}
        reference={transaction.reference}
        paymentMethod="Wallet"
        fee={fee}
        total={transaction.amount + fee}
        onShare={() => void shareReceipt()}
        onCopy={() => void copyReceipt()}
      />
    );
  };

  const renderReceive = () => {
    const phone = wallet?.phoneNumber;
    const account = wallet?.accountNumber;
    const qrValue = receiveCode?.code ?? null;
    return (
      <View style={styles.stack}>
        <AppIllustration name="qrScan" width={196} height={116} />
        <View style={styles.qrCard}>
          <AppText variant="title2">Your wallet</AppText>
          <View style={[styles.qrWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.qrInner}>
              {qrValue ? (
                <QRCode value={qrValue} size={180} backgroundColor="#FFFFFF" color="#14231F" />
              ) : (
                <AppText variant="caption" color={colors.textTertiary} align="center">
                  {receiveError ?? 'Generating your code…'}
                </AppText>
              )}
            </View>
          </View>
          <AppText variant="caption" color={colors.textTertiary} align="center">
            {receiveCode
              ? `Scan to pay you · code refreshes ${formatDateTime(receiveCode.expiresAt)}`
              : 'Share this code to get paid instantly'}
          </AppText>
          {phone ? (
            <View style={[styles.idRow, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
              <AppIcon name="phone" size={16} color={colors.primary} />
              <AppText variant="bodyStrong" color={colors.primary}>
                {prettyPhone(phone)}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.inlineActions}>
          <Button
            label="Refresh code"
            loading={receiveBusy}
            onPress={() => void loadReceiveCode()}
          />
          <SecondaryButton
            label="Copy code"
            disabled={!qrValue}
            onPress={() => qrValue && void copyText('Receive code', qrValue)}
          />
        </View>

        <View style={styles.inlineActions}>
          <SecondaryButton
            label="Copy number"
            disabled={!phone}
            onPress={() => phone && void copyText('Phone number', phone)}
          />
          <SecondaryButton
            label="Copy account"
            disabled={!account}
            onPress={() => account && void copyText('Account number', account)}
          />
        </View>

        <AppText variant="caption" color={colors.textTertiary} align="center">
          Share either to receive money. Transfers land instantly on your wallet.
        </AppText>
      </View>
    );
  };

  const renderRequestRecipient = () =>
    renderRecipientStep({
      title:
        'The payer will get a request notification once you confirm. Money requests are only sent to registered Mori Pay users.',
      value: requestPhone,
      onChange: setRequestPhone,
      hint: 'We will confirm the person has a Mori Pay account before you continue.',
      illustration: 'transferMoney',
      lookup: requestActiveLookup,
      onContinue: continueRequestRecipient,
    });

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
      {error ? <StatusBanner tone="error" title="Check the amount" message={error} onDismiss={() => setError(null)} /> : null}
      <Button label="Continue" onPress={continueRequestAmount} />
    </View>
  );

  const requestRows: DetailRow[] = [
    { label: 'Requested from', value: prettyPhone(requestPhoneNorm ?? requestPhone) },
    { label: 'Amount', value: formatMoney(Number(requestAmount || '0'), 'TZS') },
    { label: 'Note', value: requestNote || 'No message' },
  ];

  const renderRequestReview = () => (
    <View style={styles.stack}>
      {error ? <StatusBanner tone="error" title="Could not send" message={error} onDismiss={() => setError(null)} /> : null}
      <PaymentReview
        title="Review request"
        subtitle="Share this with the payer."
        rows={requestRows}
        primaryLabel="Send request"
        secondaryLabel="Edit"
        onPrimary={() => void submitRequest()}
        onSecondary={() => setScreen('request-amount')}
      />
    </View>
  );

  const renderRequestResult = () => {
    const request: MoneyRequest | undefined = requestResult?.request;
    return (
      <View style={styles.stack}>
        <PaymentStatus state="pending" label="Request sent" />
        {request ? (
          <View style={[styles.infoContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText variant="title1">Request details</AppText>
            <View style={styles.inputInline}>
              <AppText variant="bodySmall" color={colors.textSecondary}>Requested from</AppText>
              <AppText variant="bodyStrong">
                {request.payerName ?? prettyPhone(request.payerPhone)}
              </AppText>
            </View>
            <View style={styles.inputInline}>
              <AppText variant="bodySmall" color={colors.textSecondary}>Amount</AppText>
              <AppText variant="bodyStrong" numeric>{formatMoney(request.amount, request.currency)}</AppText>
            </View>
            <View style={styles.inputInline}>
              <AppText variant="bodySmall" color={colors.textSecondary}>Reference</AppText>
              <AppText variant="bodyStrong">{request.reference}</AppText>
            </View>
            <View style={styles.inputInline}>
              <AppText variant="bodySmall" color={colors.textSecondary}>Date / time</AppText>
              <AppText variant="bodyStrong">{formatDateTime(request.createdAt)}</AppText>
            </View>
          </View>
        ) : null}
        {error ? <StatusBanner tone="error" title="Could not send" message={error} onDismiss={() => setError(null)} /> : null}
        <Button label="Done" onPress={goHome} />
      </View>
    );
  };

  const renderMerchant = () => {
    const scanQrButton = (
      <SecondaryButton
        label="Scan merchant QR"
        block
        onPress={() => {
          setError(null);
          setScreen('qr-scan');
        }}
      />
    );
    if (merchants.loading) {
      return (
        <View style={styles.stack}>
          {scanQrButton}
          <EmptyState icon="payments" title="Loading merchants…" description="Fetching approved merchant accounts." />
        </View>
      );
    }
    if (merchants.error) {
      return (
        <View style={styles.stack}>
          {scanQrButton}
          <EmptyState
            icon="payments"
            illustration="noSignal"
            title="Could not load merchants"
            description="Pull down or try again later."
          />
        </View>
      );
    }
    if (!merchants.data || merchants.data.length === 0) {
      return (
        <View style={styles.stack}>
          {scanQrButton}
          <EmptyState
            icon="payments"
            illustration="mobilePay"
            title="No merchants yet"
            description="Approved merchants will appear here."
          />
        </View>
      );
    }
    return (
      <View style={styles.stack}>
        <AppIllustration name="mobilePay" width={204} height={132} />
        <AppText variant="bodySmall" color={colors.textSecondary}>
          Choose where you want to pay or scan a merchant QR code.
        </AppText>
        {scanQrButton}
        {merchants.data.map((merchant) => {
          const selected = merchant.id === payMerchantId;
          return (
            <Pressable
              key={merchant.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => setPayMerchantId(merchant.id)}
              style={({ pressed }) => [
                styles.merchantCard,
                {
                  backgroundColor: pressed ? colors.surfacePressed : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                  borderWidth: selected ? 1.5 : 1,
                  borderRadius: radius.lg,
                  padding: space.base,
                },
              ]}>
              <View style={[styles.merchantAvatar, { backgroundColor: colors.primarySoft }]}>
                <AppText variant="bodyStrong" color={colors.primary}>
                  {merchant.name.slice(0, 1).toUpperCase()}
                </AppText>
              </View>
              <View style={styles.contactCopy}>
                <AppText variant="title3">{merchant.name}</AppText>
                <AppText variant="bodySmall" color={colors.textSecondary}>
                  {merchant.identifier}
                </AppText>
                <AppText variant="bodySmall" color={colors.textTertiary}>
                  {merchant.category}
                </AppText>
              </View>
              {selected ? <AppIcon name="check" size={20} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
        {error ? <StatusBanner tone="error" title="Check the details" message={error} onDismiss={() => setError(null)} /> : null}
        <Button label="Continue" disabled={!payMerchantId} onPress={() => { setError(null); setScreen('pay-amount'); }} />
      </View>
    );
  };

  const renderMerchantQrAmount = () => (
    <View style={styles.stack}>
      <AppText variant="bodySmall" color={colors.textSecondary}>
        This static merchant QR does not set an amount. Enter the amount you want to pay.
      </AppText>
      <ProfileField
        label="Amount (TZS)"
        value={merchantQrAmount}
        onChangeText={setMerchantQrAmount}
        keyboardType="number-pad"
        accessibilityLabel="Merchant QR payment amount in Tanzanian shillings"
      />
      {error ? <StatusBanner tone="error" title="Check the amount" message={error} onDismiss={() => setError(null)} /> : null}
      <Button label="Verify payment" loading={busy} onPress={() => void continueMerchantQrAmount()} />
    </View>
  );

  const merchantQrRows: DetailRow[] = [
    { label: 'Verified merchant', value: merchantQrPreview?.merchantName ?? '' },
    { label: 'Amount', value: formatMoney(merchantQrPreview?.amount ?? 0, 'TZS') },
    { label: 'Fee', value: formatMoney(merchantQrPreview?.fee ?? 0, 'TZS'), muted: true },
    { label: 'Total', value: formatMoney(merchantQrPreview?.total ?? 0, 'TZS') },
  ];

  const renderMerchantQrReview = () => (
    <View style={styles.stack}>
      <StatusBanner
        tone="success"
        title="Merchant verified"
        message="Review the merchant and amount returned by Mori Pay before confirming."
      />
      <PaymentReview
        title="Review merchant QR payment"
        subtitle="Your payment is sent to this verified merchant."
        rows={merchantQrRows}
        primaryLabel="Confirm payment"
        secondaryLabel="Cancel"
        onPrimary={() => {
          Keyboard.dismiss();
          setPinReason('qr');
        }}
        onSecondary={() => {
          setMerchantQrPreview(null);
          setMerchantQrCode(null);
          setScreen('merchant');
        }}
      />
    </View>
  );

  const renderMerchantQrResult = () => {
    if (!merchantQrResult) return <EmptyState icon="transactions" title="Payment complete" description="" />;
    const { transaction } = merchantQrResult;
    if (transaction.status === 'pending' || transaction.status === 'processing') {
      return (
        <PaymentPending
          amount={transaction.amount}
          recipient={merchantQrResult.merchantName}
          reference={transaction.reference}
          onPrimary={() => router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })}
          onSecondary={goHome}
        />
      );
    }
    if (transaction.status !== 'completed') {
      return (
        <PaymentFailed
          amount={transaction.amount}
          recipient={merchantQrResult.merchantName}
          status={transaction.status === 'cancelled' ? 'cancelled' : 'failed'}
          onPrimary={() => setScreen('merchant')}
          onSecondary={goHome}
        />
      );
    }
    return (
      <PaymentSuccess
        amount={transaction.amount}
        fee={merchantQrResult.fee}
        total={transaction.amount + merchantQrResult.fee}
        transactionId={transaction.id}
        recipient={merchantQrResult.merchantName}
        reference={transaction.reference}
        dateTime={formatDateTime(transaction.createdAt)}
        onPrimary={goHome}
        onSecondary={goHome}
      />
    );
  };

  const renderPayAmount = () => (
    <View style={styles.stack}>
      <AmountInput
        value={payAmount}
        onChangeText={setPayAmount}
        note={payNote}
        onNoteChange={setPayNote}
        title={selectedMerchant ? `Pay ${selectedMerchant.name}` : 'Pay amount'}
        subtitle="Optional note"
      />
      {error ? <StatusBanner tone="error" title="Check the amount" message={error} onDismiss={() => setError(null)} /> : null}
      <Button label="Continue" loading={busy} onPress={() => void continuePayAmount()} />
    </View>
  );

  const payRows: DetailRow[] = [
    { label: 'Merchant', value: payPreview?.merchantName ?? selectedMerchant?.name ?? '' },
    { label: 'Amount', value: formatMoney(Number(payAmount || '0'), 'TZS') },
    {
      label: payPreview && payPreview.feePercentage > 0
        ? `Fee (${Number((payPreview.feePercentage * 100).toFixed(2))}%)`
        : 'Fee',
      value: payPreview ? formatMoney(payPreview.fee, 'TZS') : '…',
      muted: true,
    },
    {
      label: 'Total',
      value: payPreview ? formatMoney(payPreview.total, 'TZS') : '…',
    },
    { label: 'Note', value: payNote || 'No note' },
  ];

  const renderPayReview = () => (
    <PaymentReview
      title="Review payment"
      subtitle="Please confirm the merchant details."
      rows={payRows}
      primaryLabel="Confirm"
      secondaryLabel="Edit"
      onPrimary={() => {
        Keyboard.dismiss();
        setPinReason('pay');
      }}
      onSecondary={() => setScreen('pay-amount')}
    />
  );

  const renderPayResult = () => {
    if (!payResult) return <EmptyState icon="transactions" title="…" description="" />;
    const { transaction } = payResult;
    if (transaction.status === 'pending' || transaction.status === 'processing') {
      return (
        <PaymentPending
          amount={transaction.amount}
          recipient={payResult.merchantName}
          reference={transaction.reference}
          onPrimary={() => router.push({ pathname: '/transaction/[id]', params: { id: transaction.id } })}
          onSecondary={goHome}
        />
      );
    }
    if (transaction.status !== 'completed') {
      return renderPayFailed(transaction.status === 'cancelled' ? 'cancelled' : 'failed');
    }
    return (
      <PaymentSuccess
        amount={transaction.amount}
        fee={payResult.fee}
        total={transaction.amount + payResult.fee}
        transactionId={transaction.id}
        recipient={payResult.merchantName}
        reference={transaction.reference}
        dateTime={formatDateTime(transaction.createdAt)}
        onPrimary={() => setScreen('send-receipt')}
        onSecondary={goHome}
      />
    );
  };

  const renderPayFailed = (status: 'failed' | 'cancelled' = 'failed') => (
    <PaymentFailed
      amount={Number(payAmount || '0')}
      recipient={selectedMerchant?.name ?? 'Merchant'}
      status={status}
      onPrimary={() => setScreen('pay-amount')}
      onSecondary={goHome}
    />
  );

  const headerConfig = useMemo(() => {
    switch (activeScreen) {
      case 'send-recipient':
        return { title: 'Send money', step: 'Recipient', icon: 'send' as const };
      case 'send-amount':
        return { title: 'Send money', step: 'Amount', icon: 'send' as const };
      case 'send-review':
        return { title: 'Send money', step: 'Review', icon: 'send' as const };
      case 'send-result':
        return { title: 'Send money', step: 'Result', icon: 'send' as const };
      case 'send-receipt':
        return { title: 'Receipt', step: 'Confirmation', icon: 'receipt' as const };
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
      case 'merchant':
        return { title: 'Pay', step: 'Merchant', icon: 'pay' as const };
      case 'pay-amount':
        return { title: 'Pay', step: 'Amount', icon: 'pay' as const };
      case 'pay-review':
        return { title: 'Pay', step: 'Review', icon: 'pay' as const };
      case 'pay-result':
        return { title: 'Pay', step: 'Result', icon: 'pay' as const };
      case 'qr-scan':
      case 'qr-amount':
        return { title: 'Pay', step: 'Scan merchant QR', icon: 'pay' as const };
      case 'qr-review':
        return { title: 'Pay', step: 'Review QR payment', icon: 'pay' as const };
      case 'qr-result':
        return { title: 'Pay', step: 'Result', icon: 'pay' as const };
      default:
        return { title: 'Payments', step: 'Overview', icon: 'payments' as const };
    }
  }, [activeScreen]);

  const content = (() => {
    switch (activeScreen) {
      case 'send-recipient':
        return renderSendRecipient();
      case 'send-amount':
        return renderSendAmount();
      case 'send-review':
        return renderSendReview();
      case 'send-result':
        return sendResult ? renderSendResult() : renderSendFailed();
      case 'send-receipt':
        return renderReceipt();
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
      case 'merchant':
        return renderMerchant();
      case 'qr-scan':
        return (
          <QRCodeScanner
            onScan={(code) => void resolveMerchantQr(code)}
            onCancel={() => setScreen('merchant')}
          />
        );
      case 'qr-amount':
        return renderMerchantQrAmount();
      case 'qr-review':
        return renderMerchantQrReview();
      case 'qr-result':
        return renderMerchantQrResult();
      case 'pay-amount':
        return renderPayAmount();
      case 'pay-review':
        return renderPayReview();
      case 'pay-result':
        return payResult ? renderPayResult() : renderPayFailed();
      default:
        return renderOverview();
    }
  })();

  const pinSheet = pinReason ? (
    <View style={styles.pinSheet}>
      <AppText variant="bodySmallStrong" align="center">
        {pinReason === 'qr' ? 'Enter your PIN to pay this verified merchant' : 'Enter your PIN to confirm'}
      </AppText>
      <PinBoxes
        value={pinEntry}
        onChangeText={onPinChange}
        autoFocus
        editable={!busy}
      />
      {busy ? (
        <View style={styles.processingInline}>
          <SegmentedSpinner
            size={24}
            label={
              pinReason === 'send'
                ? 'Sending transfer'
                : 'Confirming payment'
            }
          />
          <AppText variant="caption" color={colors.textSecondary}>
            {pinReason === 'send' ? 'Sending your transfer…' : 'Confirming your payment…'}
          </AppText>
        </View>
      ) : null}
      {error ? (
        <StatusBanner tone="error" title="PIN rejected" message={error} onDismiss={() => setError(null)} />
      ) : null}
      <SecondaryButton label="Cancel" block disabled={busy} onPress={closePin} />
    </View>
  ) : null;

  return (
    <ScreenContainer
      header={
        <View style={[styles.safeHeader, { paddingTop: insets.top + 12 }]}>
          {activeScreen !== 'overview' ? (
            <FlowHeader
              title={headerConfig.title}
              step={headerConfig.step}
              icon={headerConfig.icon}
              onBack={handleBack}
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
      contentContainerStyle={styles.contentContainer}
      scroll={!(activeScreen === 'send-recipient' && scanningSendCode) && activeScreen !== 'qr-scan'}
      bottomInset={18}
    >
      {pinSheet ?? content}
      <AppDialog
        visible={dialog !== null}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        onClose={() => setDialog(null)}
        testID="payments-dialog"
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  overviewIntro: {
    gap: 4,
    marginBottom: 4,
  },
  moreWaysHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
    marginBottom: -4,
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
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  contentContainer: {
    paddingTop: 12,
    paddingBottom: 32,
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
  pinSheet: {
    gap: 12,
  },
  processingInline: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
});