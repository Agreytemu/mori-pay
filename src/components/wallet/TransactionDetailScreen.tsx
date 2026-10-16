import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
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

function receiptHtml(transaction: Transaction, logoSource: string): string {
  const total = transaction.direction === 'debit'
    ? transaction.amount + transaction.fee
    : transaction.amount;
  const rows: [string, string][] = [
    ['Transaction type', TRANSACTION_TYPE_LABEL[transaction.type]],
    ['Status', TRANSACTION_STATUS_LABEL[transaction.status]],
    ['Reference', transaction.reference],
    ['Transaction ID', transaction.id],
    ['Date and time', formatDateTime(transaction.createdAt)],
    ['Category', TRANSACTION_CATEGORY_LABEL[transaction.category]],
    ['Payment channel', CHANNEL_LABEL[transaction.channel]],
    ['Direction', transaction.direction === 'debit' ? 'Money sent' : 'Money received'],
    [
      transaction.channel === 'mobileMoney' &&
        (transaction.type === 'deposit' || transaction.type === 'withdrawal')
        ? 'Mobile number'
        : 'Counterparty',
      transaction.counterparty,
    ],
  ];
  const outcomeReason = getTransactionOutcomeReason(transaction);
  if (outcomeReason) rows.splice(2, 0, ['Reason', outcomeReason]);
  const mobileNetwork =
    transaction.channel === 'mobileMoney' &&
    (transaction.type === 'deposit' || transaction.type === 'withdrawal') &&
    transaction.counterpartyDetail &&
    transaction.counterpartyDetail !== 'Mobile money'
      ? mobileNetworkDisplayName(transaction.counterpartyDetail)
      : undefined;
  if (mobileNetwork) rows.push(['Mobile network', mobileNetwork]);
  else if (transaction.counterpartyDetail) {
    rows.push(['Counterparty details', transaction.counterpartyDetail]);
  }
  if (transaction.note) rows.push(['Note', transaction.note]);
  if (transaction.feeFlat) rows.push(['Flat fee', formatAmount(transaction.feeFlat, transaction.currency)]);
  if (transaction.feePercentage) {
    rows.push(['Fee rate', `${(transaction.feePercentage * 100).toFixed(2)}%`]);
  }

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body { font-family: Arial, sans-serif; color: #132238; margin: 32px; }
      header { display: flex; align-items: center; gap: 16px; border-bottom: 2px solid #153e75; padding-bottom: 18px; margin-bottom: 20px; }
      header img { width: 76px; height: 76px; object-fit: contain; }
      .heading { flex: 1; }
      h1 { color: #153e75; font-size: 25px; margin: 0 0 5px; }
      .brand { color: #667085; font-size: 13px; }
      .amount { font-size: 25px; font-weight: bold; margin: 20px 0 4px; }
      .label { color: #667085; font-size: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 22px; }
      td { border-bottom: 1px solid #e5eaf0; padding: 11px 0; vertical-align: top; font-size: 13px; }
      td:first-child { color: #667085; width: 40%; }
      td:last-child { text-align: right; overflow-wrap: anywhere; font-weight: 600; }
      .total { border-top: 2px solid #153e75; font-size: 15px; font-weight: bold; }
      footer { margin-top: 28px; color: #667085; font-size: 11px; text-align: center; }
    </style>
  </head>
  <body>
    <header>
      <img src="${escapeHtml(logoSource)}" alt="Mori Pay" />
      <div class="heading"><h1>Mori Pay receipt</h1><div class="brand">Transaction confirmation</div></div>
    </header>
    <div class="label">${transaction.direction === 'debit' ? 'Total debited' : 'Total received'}</div>
    <div class="amount">${escapeHtml(formatAmount(total, transaction.currency))}</div>
    <table>
      ${rows.map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`).join('')}
      <tr><td>Amount</td><td>${escapeHtml(formatAmount(transaction.amount, transaction.currency))}</td></tr>
      <tr><td>Fee</td><td>${escapeHtml(formatAmount(transaction.fee, transaction.currency))}</td></tr>
      <tr class="total"><td>${transaction.direction === 'debit' ? 'Total debited' : 'Total received'}</td><td>${escapeHtml(formatAmount(total, transaction.currency))}</td></tr>
    </table>
    <footer>Keep this receipt for your records. Generated by Mori Pay.</footer>
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

  const loadTransaction = useCallback(async () => {
    try {
      const result = await getTransaction(id);
      setTransaction(toUiTransaction(result));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this transaction.');
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
      const html = receiptHtml(transaction, logoSource);
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
  }, [transaction]);

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

  const total = transaction.direction === 'debit'
    ? transaction.amount + transaction.fee
    : transaction.amount;
  const totalLabel = transaction.direction === 'debit' ? 'Total debited' : 'Total received';
  const mobileNetwork =
    transaction.channel === 'mobileMoney' &&
    (transaction.type === 'deposit' || transaction.type === 'withdrawal') &&
    transaction.counterpartyDetail &&
    transaction.counterpartyDetail !== 'Mobile money'
      ? mobileNetworkDisplayName(transaction.counterpartyDetail)
      : null;
  const outcomeReason = getTransactionOutcomeReason(transaction);

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
          <AppText variant="bodySmall" color={colors.textSecondary}>
            {transaction.direction === 'debit' ? 'Money sent' : 'Money received'}
          </AppText>
          <Image
            source={MORI_PAY_LOGO}
            contentFit="contain"
            accessibilityLabel="Mori Pay"
            style={styles.brandLogo}
          />
          <AppText variant="amount" numeric style={styles.summaryAmount}>
            {transaction.direction === 'debit' ? '−' : '+'}
            {formatAmount(transaction.amount, transaction.currency)}
          </AppText>
          <AppText variant="bodySmallStrong">{transaction.counterparty}</AppText>
          <StatusBadge
            label={TRANSACTION_STATUS_LABEL[transaction.status]}
            tone={STATUS_TONE[transaction.status]}
            size="md"
          />
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
          <AppText variant="bodyStrong" style={styles.sectionTitle}>Transaction</AppText>
          {displayRow('Type', TRANSACTION_TYPE_LABEL[transaction.type])}
          {displayRow('Status', TRANSACTION_STATUS_LABEL[transaction.status])}
          {outcomeReason ? displayRow('Reason', outcomeReason) : null}
          {displayRow('Reference', transaction.reference, { selectable: true })}
          {displayRow('Transaction ID', transaction.id, { selectable: true })}
          {displayRow('Date and time', formatDateTime(transaction.createdAt))}
          {displayRow('Category', TRANSACTION_CATEGORY_LABEL[transaction.category])}
          {displayRow('Payment channel', CHANNEL_LABEL[transaction.channel])}
          {displayRow('Direction', transaction.direction === 'debit' ? 'Money sent' : 'Money received')}
          {displayRow(
            transaction.channel === 'mobileMoney' &&
              (transaction.type === 'deposit' || transaction.type === 'withdrawal')
              ? 'Mobile number'
              : 'Counterparty',
            transaction.counterparty,
          )}
          {mobileNetwork ? displayRow('Mobile network', mobileNetwork) : null}
          {!mobileNetwork && transaction.counterpartyDetail
            ? displayRow('Counterparty details', transaction.counterpartyDetail, { selectable: true })
            : null}
          {transaction.note ? displayRow('Note', transaction.note) : null}
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
          {displayRow('Amount', formatAmount(transaction.amount, transaction.currency), { numeric: true })}
          {displayRow('Fee', formatAmount(transaction.fee, transaction.currency), { numeric: true })}
          {transaction.feeFlat
            ? displayRow('Flat fee component', formatAmount(transaction.feeFlat, transaction.currency), { numeric: true })
            : null}
          {transaction.feePercentage
            ? displayRow('Percentage fee', `${(transaction.feePercentage * 100).toFixed(2)}%`)
            : null}
          {displayRow(totalLabel, formatAmount(total, transaction.currency), { numeric: true })}
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
  content: {
    flexGrow: 1,
    paddingTop: 12,
  },
  summary: {
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  summaryAmount: {
    textAlign: 'center',
  },
  brandLogo: {
    width: 82,
    height: 72,
  },
  detailsCard: {
    borderWidth: StyleSheet.hairlineWidth,
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
  rowValue: {
    flex: 1,
    textAlign: 'right',
    flexWrap: 'wrap',
  },
});
