import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';
import { mobileNetworkDisplayName } from '@mori-pay/contracts';

import { AppIcon } from '@/components/ui/AppIcon';
import { AppText } from '@/components/ui/AppText';
import { SegmentedSpinner } from '@/components/ui/SegmentedSpinner';
import { SecondaryButton, PrimaryButton } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  TRANSACTION_CATEGORY_LABEL,
  TRANSACTION_STATUS_LABEL,
  TRANSACTION_TYPE_LABEL,
  type Transaction,
} from '@/types/transaction';
import { toUiTransaction } from '@/lib/adapters';
import { getTransaction } from '@/lib/mori-api';
import { notifyTransactionCompleted } from '@/lib/transaction-feedback';
import { useAppTheme, type StateTone } from '@/theme';
import { formatAmount, formatDateTime } from '@/utils/format';
import { getTransactionOutcomeReason } from '@/utils/transaction-outcome';

const MORI_PAY_LOGO = require('../../../assets/images/mori pay official logo.png');

const CHANNEL_LABEL: Record<Transaction['channel'], string> = {
  wallet: 'Mori Pay wallet',
  bank: 'Bank',
  mobileMoney: 'Mobile money',
  card: 'Card',
};

const STATUS_TONE: Record<Transaction['status'], StateTone> = {
  completed: 'success',
  processing: 'warning',
  pending: 'warning',
  failed: 'error',
  cancelled: 'neutral',
};

/** Colours used for the status pill printed on the receipt. */
const RECEIPT_STATUS_COLOURS: Record<Transaction['status'], { bg: string; fg: string }> = {
  completed: { bg: '#dcfce7', fg: '#166534' },
  processing: { bg: '#fef3c7', fg: '#92400e' },
  pending: { bg: '#fef3c7', fg: '#92400e' },
  failed: { bg: '#fee2e2', fg: '#991b1b' },
  cancelled: { bg: '#e5e7eb', fg: '#374151' },
};

/** Deep link encoded in the receipt QR code so it can be verified in the app. */
function receiptVerificationLink(transaction: Transaction): string {
  return `lipanaagreytemu://transaction/${transaction.id}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

type ReceiptRow = [label: string, value: string];

interface ReceiptRows {
  total: number;
  totalLabel: string;
  details: ReceiptRow[];
  breakdown: ReceiptRow[];
}

/**
 * Single source of truth for the receipt field set. Used by both the PDF export
 * and the on-screen detail view so the two can never drift apart.
 */
function buildReceiptRows(transaction: Transaction): ReceiptRows {
  const isDebit = transaction.direction === 'debit';
  const total = isDebit ? transaction.amount + transaction.fee : transaction.amount;
  const totalLabel = isDebit ? 'Total debited' : 'Total received';
  const money = (value: number) => formatAmount(value, transaction.currency);

  const isMobileMovement =
    transaction.channel === 'mobileMoney' &&
    (transaction.type === 'deposit' || transaction.type === 'withdrawal');
  const mobileNetwork =
    isMobileMovement &&
    transaction.counterpartyDetail &&
    transaction.counterpartyDetail !== 'Mobile money'
      ? mobileNetworkDisplayName(transaction.counterpartyDetail)
      : null;
  const outcomeReason = getTransactionOutcomeReason(transaction);

  const details: ReceiptRow[] = [
    ['Transaction type', TRANSACTION_TYPE_LABEL[transaction.type]],
    ['Category', TRANSACTION_CATEGORY_LABEL[transaction.category]],
    ['Payment channel', CHANNEL_LABEL[transaction.channel]],
    ['Direction', isDebit ? 'Money sent' : 'Money received'],
    ['Status', TRANSACTION_STATUS_LABEL[transaction.status]],
    [isMobileMovement ? 'Mobile number' : 'Recipient', transaction.counterparty],
  ];
  if (mobileNetwork) details.push(['Mobile network', mobileNetwork]);
  else if (transaction.counterpartyDetail) {
    details.push(['Counterparty details', transaction.counterpartyDetail]);
  }
  details.push(['Description', transaction.note || transaction.counterparty]);
  if (outcomeReason) details.push(['Reason', outcomeReason]);
  details.push(
    ['Payment reference number', transaction.reference],
    ['Transaction ID', transaction.id],
    ['Transaction date and time', formatDateTime(transaction.createdAt)],
    ['Currency', transaction.currency],
  );

  const breakdown: ReceiptRow[] = [
    ['Amount', money(transaction.amount)],
    ['Fee', money(transaction.fee)],
  ];
  if (transaction.feeFlat) breakdown.push(['Flat fee component', money(transaction.feeFlat)]);
  if (transaction.feePercentage) {
    breakdown.push(['Fee rate', `${(transaction.feePercentage * 100).toFixed(2)}%`]);
  }

  return { total, totalLabel, details, breakdown };
}

function receiptHtml(
  transaction: Transaction,
  logoSource: string,
  qrSource: string | null,
): string {
  const { total, totalLabel, details, breakdown } = buildReceiptRows(transaction);
  const money = (value: number) => escapeHtml(formatAmount(value, transaction.currency));

  const status = RECEIPT_STATUS_COLOURS[transaction.status];
  const rows = (items: ReceiptRow[]) =>
    items
      .map(
        ([label, value]) =>
          `<tr><td class="label">${escapeHtml(label)}</td><td class="value">${escapeHtml(value)}</td></tr>`,
      )
      .join('');

  const verifyBlock = qrSource
    ? `<div class="verify">
        <img src="${qrSource}" alt="Mori Pay verification QR code" />
        <div class="caption">Scan to verify the authenticity of this receipt</div>
        <div class="hint">Opens this transaction in the Mori Pay app.</div>
      </div>`
    : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mori Pay receipt ${escapeHtml(transaction.reference)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111827; background: #ffffff; margin: 0; padding: 32px 24px; }
      .receipt { max-width: 640px; margin: 0 auto; }
      .top { text-align: center; padding-bottom: 20px; border-bottom: 2px solid #0f3d2e; }
      .top img { width: 84px; height: 84px; object-fit: contain; }
      .brand { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; margin-top: 8px; color: #0f3d2e; }
      .doc { font-size: 12px; letter-spacing: 3px; text-transform: uppercase; color: #6b7280; margin-top: 4px; }
      .hero { text-align: center; padding: 24px 0 8px; }
      .hero .label { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #6b7280; }
      .hero .amount { font-size: 34px; font-weight: 800; margin-top: 6px; }
      .status { display: inline-block; margin-top: 12px; padding: 5px 16px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; }
      .section { margin-top: 26px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #0f3d2e; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      td { padding: 11px 0; border-bottom: 1px solid #e5e7eb; font-size: 13px; vertical-align: top; }
      td.label { color: #6b7280; width: 46%; }
      td.value { text-align: right; font-weight: 600; overflow-wrap: anywhere; }
      tr.total td { border-top: 2px solid #0f3d2e; border-bottom: none; font-size: 15px; font-weight: 800; padding-top: 14px; color: #0f3d2e; }
      .verify { margin-top: 34px; padding-top: 26px; border-top: 1px dashed #d1d5db; text-align: center; }
      .verify img { width: 148px; height: 148px; }
      .verify .caption { margin-top: 14px; font-size: 12px; font-weight: 700; color: #111827; }
      .verify .hint { margin-top: 4px; font-size: 11px; color: #6b7280; }
      footer { margin-top: 26px; text-align: center; font-size: 11px; color: #6b7280; }
    </style>
  </head>
  <body>
    <div class="receipt">
      <div class="top">
        <img src="${escapeHtml(logoSource)}" alt="Mori Pay" />
        <div class="brand">Mori Pay</div>
        <div class="doc">Transaction Receipt</div>
      </div>

      <div class="hero">
        <div class="label">${totalLabel}</div>
        <div class="amount">${money(total)}</div>
        <div class="status" style="background:${status.bg};color:${status.fg}">
          ${escapeHtml(TRANSACTION_STATUS_LABEL[transaction.status])}
        </div>
      </div>

      <div class="section">Transaction details</div>
      <table>${rows(details)}</table>

      <div class="section">Amount breakdown</div>
      <table>
        ${rows(breakdown)}
        <tr class="total"><td class="label">${totalLabel}</td><td class="value">${money(total)}</td></tr>
      </table>

      ${verifyBlock}

      <footer>Keep this receipt for your records. Generated by Mori Pay.</footer>
    </div>
  </body>
</html>`;
}

export function TransactionDetailScreen() {
  const { colors, space, radius } = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusCheckStoppedForId, setStatusCheckStoppedForId] = useState<string | null>(null);
  const [statusCheckAttempt, setStatusCheckAttempt] = useState(0);
  const receiptQrRef = useRef<{ toDataURL?: (callback: (data: string) => void) => void } | null>(
    null,
  );

  const getReceiptQrSource = useCallback(
    (): Promise<string | null> =>
      new Promise((resolve) => {
        const reference = receiptQrRef.current;
        if (!reference?.toDataURL) {
          resolve(null);
          return;
        }
        let settled = false;
        const finish = (value: string | null) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        const timer = setTimeout(() => finish(null), 3000);
        try {
          reference.toDataURL((data: string) => {
            clearTimeout(timer);
            finish(data.startsWith('data:') ? data : `data:image/png;base64,${data}`);
          });
        } catch {
          clearTimeout(timer);
          finish(null);
        }
      }),
    [],
  );

  const loadTransaction = useCallback(async () => {
    try {
      const result = await getTransaction(id);
      setTransaction(toUiTransaction(result));
      if (result.status === 'completed') {
        void notifyTransactionCompleted(result.id);
      }
    } catch {
      setError('Could not load this transaction. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    getTransaction(id)
      .then((result) => {
        if (!active) return;
        setTransaction(toUiTransaction(result));
        if (result.status === 'completed') {
          void notifyTransactionCompleted(result.id);
        }
      })
      .catch(() => {
        if (active) {
          setError('Could not load this transaction. Check your connection and try again.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const transactionStatus = transaction?.status;

  useEffect(() => {
    if (
      transactionStatus !== 'pending' &&
      transactionStatus !== 'processing'
    ) {
      return;
    }
    let active = true;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const checkStatus = async () => {
      try {
        const latest = await getTransaction(id);
        if (!active) return;
        setTransaction(toUiTransaction(latest));
        if (latest.status === 'completed') {
          void notifyTransactionCompleted(latest.id);
          return;
        }
        if (latest.status === 'failed' || latest.status === 'cancelled') return;
      } catch {
        // A failed read cannot be treated as a failed transaction.
      }

      attempts += 1;
      if (active && attempts < 10) {
        timer = setTimeout(() => void checkStatus(), 3_000);
      } else if (active) {
        setStatusCheckStoppedForId(id);
      }
    };

    timer = setTimeout(() => void checkStatus(), 1_500);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [id, statusCheckAttempt, transactionStatus]);

  const downloadReceipt = useCallback(async () => {
    if (!transaction) return;
    setExporting(true);
    setError(null);
    try {
      const logoAsset = Asset.fromModule(MORI_PAY_LOGO);
      let logoSource: string;
      if (Platform.OS === 'web') {
        logoSource = logoAsset.uri;
      } else {
        await logoAsset.downloadAsync();
        if (!logoAsset.localUri) {
          throw new Error('Could not load the Mori Pay logo for the receipt.');
        }
        const logoBase64 = await FileSystem.readAsStringAsync(logoAsset.localUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        logoSource = `data:image/${logoAsset.type};base64,${logoBase64}`;
      }
      const qrSource = await getReceiptQrSource();
      const html = receiptHtml(transaction, logoSource, qrSource);
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
        return;
      }
      const { uri } = await Print.printToFileAsync({ html });
      const sharingAvailable = await Sharing.isAvailableAsync();
      if (!sharingAvailable) {
        throw new Error('PDF receipt was created, but file sharing is unavailable on this device.');
      }
      await Sharing.shareAsync(uri, {
        dialogTitle: 'Download Mori Pay receipt',
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare the receipt PDF.');
    } finally {
      setExporting(false);
    }
  }, [transaction, getReceiptQrSource]);

  const displayRow = (
    label: string,
    value: string,
    options: { numeric?: boolean; selectable?: boolean } = {},
  ) => (
    <View
      key={label}
      style={[
        styles.detailRow,
        { borderBottomColor: colors.divider },
      ]}>
      <AppText variant="bodySmall" color={colors.textSecondary}>{label}</AppText>
      <AppText
        variant="bodySmallStrong"
        numeric={options.numeric}
        selectable={options.selectable}
        style={styles.rowValue}>
        {value}
      </AppText>
    </View>
  );

  const header = (
    <View style={[styles.header, { paddingHorizontal: space.base }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={({ pressed }) => [
          styles.backButton,
          {
            borderRadius: radius.circle,
            backgroundColor: pressed ? colors.surfacePressed : colors.surface,
            borderColor: colors.border,
          },
        ]}>
        <AppIcon name="chevronLeft" size={19} color={colors.text} />
      </Pressable>
      <View>
        <AppText variant="title2">Transaction details</AppText>
        <AppText variant="caption" color={colors.textSecondary}>Mori Pay</AppText>
      </View>
    </View>
  );

  if (loading && !transaction) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        {header}
        <View style={styles.centered}>
          <SegmentedSpinner size={32} label="Loading transaction details" />
          <AppText variant="bodySmall" color={colors.textSecondary}>Checking transaction status…</AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (!transaction) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        {header}
        <View style={[styles.centered, { padding: space.lg, gap: space.md }]}>
          <AppIcon name="warning" size={32} color={colors.error} />
          <AppText variant="title3" align="center">Could not load transaction</AppText>
          <AppText variant="bodySmall" color={colors.textSecondary} align="center">{error}</AppText>
          <SecondaryButton
            label="Try again"
            onPress={() => {
              setLoading(true);
              setError(null);
              void loadTransaction();
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const { total, totalLabel, details, breakdown } = buildReceiptRows(transaction);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      {header}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: space.base, paddingBottom: space.xl, gap: space.md },
        ]}
        showsVerticalScrollIndicator={false}>
        <View
          style={[
            styles.summary,
            {
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              padding: space.lg,
            },
          ]}>
          <Image
            source={MORI_PAY_LOGO}
            contentFit="contain"
            accessibilityLabel="Mori Pay"
            style={styles.brandLogo}
          />
          <AppText variant="bodyStrong" style={styles.brandName}>
            Mori Pay
          </AppText>
          <AppText variant="caption" color={colors.textSecondary} style={styles.docLabel}>
            Transaction Receipt
          </AppText>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <AppText variant="bodySmall" color={colors.textSecondary}>
            {totalLabel}
          </AppText>
          <AppText variant="amount" numeric style={styles.summaryAmount}>
            {formatAmount(total, transaction.currency)}
          </AppText>
          <StatusBadge
            label={TRANSACTION_STATUS_LABEL[transaction.status]}
            tone={STATUS_TONE[transaction.status]}
            size="md"
          />
        </View>

          {transaction.status === 'pending' || transaction.status === 'processing' ? (
            <View style={[styles.statusNotice, { backgroundColor: colors.warningSoft, borderColor: colors.warningBorder }]}>
              {statusCheckStoppedForId === transaction.id ? null : (
                <SegmentedSpinner size={22} label="Checking transaction status" />
              )}
              <AppText variant="bodySmall" color={colors.textSecondary} style={styles.statusMessage}>
                {statusCheckStoppedForId === transaction.id
                  ? 'This transaction is still awaiting confirmation. Do not submit it again.'
                  : 'Checking for an update. Your balance will change only after confirmation.'}
              </AppText>
              {statusCheckStoppedForId === transaction.id ? (
                <SecondaryButton
                  label="Check status again"
                  onPress={() => {
                    setStatusCheckStoppedForId(null);
                    setStatusCheckAttempt((attempt) => attempt + 1);
                  }}
                />
              ) : null}
            </View>
          ) : null}

        <View
          style={[
            styles.detailsCard,
            {
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingHorizontal: space.base,
            },
          ]}>
          <AppText variant="bodyStrong" style={styles.sectionTitle}>Transaction details</AppText>
          {details.map(([label, value]) =>
            displayRow(label, value, {
              selectable: label === 'Transaction ID' || label === 'Payment reference number',
            }),
          )}
        </View>

        <View
          style={[
            styles.detailsCard,
            {
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              paddingHorizontal: space.base,
            },
          ]}>
          <AppText variant="bodyStrong" style={styles.sectionTitle}>Amount breakdown</AppText>
          {breakdown.map(([label, value]) => displayRow(label, value, { numeric: true }))}
          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <AppText variant="bodyStrong">{totalLabel}</AppText>
            <AppText variant="bodyStrong" numeric style={styles.rowValue}>
              {formatAmount(total, transaction.currency)}
            </AppText>
          </View>
        </View>

        <View
          style={[
            styles.detailsCard,
            styles.verifyCard,
            {
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              padding: space.base,
            },
          ]}>
          <View style={[styles.qrFrame, { borderColor: colors.border }]}>
            <QRCode
              value={receiptVerificationLink(transaction)}
              size={176}
              color="#0f3d2e"
              backgroundColor="#ffffff"
              ecl="M"
              quietZone={8}
              getRef={(instance) => {
                receiptQrRef.current = instance;
              }}
            />
          </View>
          <AppText variant="bodySmallStrong" align="center">
            Scan to verify the authenticity of this receipt
          </AppText>
          <AppText variant="caption" color={colors.textSecondary} align="center">
            Opens this transaction in the Mori Pay app.
          </AppText>
        </View>

        {error ? (
          <AppText variant="bodySmall" color={colors.error} accessibilityRole="alert">
            {error}
          </AppText>
        ) : null}
        <PrimaryButton
          label="Download receipt (PDF)"
          onPress={() => void downloadReceipt()}
          loading={exporting}
          block
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  backButton: {
    width: 42,
    height: 42,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  statusNotice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 10,
  },
  statusMessage: {
    textAlign: 'center',
  },
  content: {
    flexGrow: 1,
    paddingTop: 12,
  },
  summary: {
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryAmount: {
    textAlign: 'center',
    marginTop: 2,
  },
  brandLogo: {
    width: 82,
    height: 72,
  },
  brandName: {
    letterSpacing: 0.5,
  },
  docLabel: {
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  summaryDivider: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    marginTop: 10,
    marginBottom: 10,
  },
  detailsCard: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  verifyCard: {
    alignItems: 'center',
    gap: 12,
  },
  qrFrame: {
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  sectionTitle: {
    paddingTop: 16,
    paddingBottom: 4,
  },
  detailRow: {
    minHeight: 48,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  totalRow: {
    minHeight: 52,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 2,
  },
  rowValue: {
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
});
