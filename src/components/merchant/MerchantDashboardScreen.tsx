import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import QRCode from 'react-native-qrcode-svg';

import type {
  MerchantPortal,
  MerchantPortalQrCode,
  MerchantPortalTransaction,
} from '@mori-pay/contracts';
import { AppText } from '@/components/ui/AppText';
import { Button, DangerButton, SecondaryButton } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import {
  createMerchantFixedQr,
  createMerchantStaticQr,
  exportMerchantPortalTransactions,
  getMerchantPortal,
  getMerchantPortalTransaction,
  listMerchantPortalQrCodes,
  listMerchantPortalTransactions,
  revokeMerchantQr,
  type MerchantPortalFilters,
} from '@/lib/mori-api';
import { useSession } from '@/lib/session';
import { useAppTheme } from '@/theme';

type DashboardTab = 'overview' | 'transactions' | 'reports' | 'qr' | 'business';
type NewQr = {
  id: string;
  code: string;
  kind: 'static' | 'fixed';
  amount?: number;
  reusable: boolean;
  expiresAt?: string;
};
type ExpiryChoice = 'none' | 'day' | 'week' | 'month';

const TAB_LABELS: Record<DashboardTab, string> = {
  overview: 'Overview',
  transactions: 'Transactions',
  reports: 'Reports',
  qr: 'QR codes',
  business: 'Business',
};
const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  pending: 'Pending',
  processing: 'Processing',
  failed: 'Failed',
  cancelled: 'Cancelled',
};
const TZ = 'Africa/Dar_es_Salaam';

function money(amount: number, currency = 'TZS'): string {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function localDateValue(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function startOfLocalDay(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00+03:00`);
  return Number.isNaN(date.getTime()) || localDateValue(date) !== value
    ? undefined
    : date.toISOString();
}

function endOfLocalDay(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T23:59:59.999+03:00`);
  return Number.isNaN(date.getTime()) || localDateValue(date) !== value
    ? undefined
    : date.toISOString();
}

function displayDate(value: string | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-TZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: TZ,
  }).format(date);
}

function safeError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session expired. Sign in again.';
    if (error.status === 403) return 'This account is not allowed to access that information.';
    if (error.status === 404) return 'That merchant record could not be found.';
    if (error.status === 409) return 'This request conflicts with the current account state. Refresh and try again.';
    if (error.status === 429) return 'Too many requests. Wait a moment and try again.';
    if (error.status >= 500) return 'Mori Pay could not complete the request. Try again shortly.';
    if (error.status === 0) return 'Could not connect to Mori Pay. Check your connection and try again.';
    return 'Check the information and try again.';
  }
  return 'Mori Pay could not complete the request. Try again shortly.';
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

function receiptHtml(
  merchantName: string,
  transaction: MerchantPortalTransaction,
): string {
  const status = STATUS_LABELS[transaction.status] ?? 'Status update';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
    <title>Mori Pay merchant receipt ${escapeHtml(transaction.reference)}</title>
    <style>
      body{font-family:Arial,sans-serif;color:#10223d;margin:36px}
      main{max-width:620px;margin:auto;border:1px solid #dce5f0;border-radius:18px;padding:32px}
      h1{color:#07162e;font-size:24px;margin:0 0 6px}.sub{color:#64748b;margin:0 0 28px}
      .amount{font-size:32px;font-weight:700;margin:8px 0}.badge{display:inline-block;border-radius:20px;padding:6px 12px;background:#dcfce7;color:#166534}
      table{width:100%;border-collapse:collapse;margin-top:24px}td{padding:12px 0;border-bottom:1px solid #e2e8f0}
      td:first-child{color:#64748b}td:last-child{text-align:right;font-weight:600;word-break:break-word}
      footer{margin-top:26px;color:#64748b;font-size:12px}
    </style></head><body><main><h1>Mori Pay</h1><p class="sub">Merchant payment receipt</p>
      <p>Received by</p><strong>${escapeHtml(merchantName)}</strong>
      <p class="amount">${escapeHtml(money(transaction.merchantAmount, transaction.currency))}</p>
      <span class="badge">${escapeHtml(status)}</span>
      <table>
        <tr><td>Reference</td><td>${escapeHtml(transaction.reference)}</td></tr>
        <tr><td>Transaction ID</td><td>${escapeHtml(transaction.id)}</td></tr>
        <tr><td>Amount received</td><td>${escapeHtml(money(transaction.merchantAmount, transaction.currency))}</td></tr>
        <tr><td>Customer transaction fee</td><td>${escapeHtml(money(transaction.fee, transaction.currency))}</td></tr>
        <tr><td>Customer total paid</td><td>${escapeHtml(money(transaction.total, transaction.currency))}</td></tr>
        <tr><td>Date and time (Dar es Salaam)</td><td>${escapeHtml(displayDate(transaction.settledAt ?? transaction.createdAt))}</td></tr>
      </table><footer>This receipt reflects the confirmed merchant ledger entry. It is not a bank settlement statement.</footer>
    </main></body></html>`;
}

function qrState(qr: MerchantPortalQrCode): string {
  if (qr.revokedAt) return 'Cancelled';
  if (qr.expiresAt && Date.parse(qr.expiresAt) <= Date.now()) return 'Expired';
  if (qr.kind === 'fixed' && !qr.reusable && qr.uses > 0) return 'Used';
  return 'Active';
}

export function MerchantDashboardScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { colors, radius, space } = useAppTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const qrRef = useRef<{ toDataURL?: (callback: (data: string) => void) => void } | null>(
    null,
  );
  const [tab, setTab] = useState<DashboardTab>('overview');
  const [portal, setPortal] = useState<MerchantPortal | null>(null);
  const [qrCodes, setQrCodes] = useState<MerchantPortalQrCode[]>([]);
  const [newQr, setNewQr] = useState<NewQr | null>(null);
  const [loading, setLoading] = useState(true);
  const [operationBusy, setOperationBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [transactions, setTransactions] = useState<MerchantPortalTransaction[]>([]);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<MerchantPortalTransaction | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [fromDate, setFromDate] = useState(() =>
    localDateValue(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)),
  );
  const [toDate, setToDate] = useState(() => localDateValue(new Date()));
  const [todayEpoch] = useState(() => Date.now());
  const [fixedAmount, setFixedAmount] = useState('');
  const [fixedReusable, setFixedReusable] = useState(false);
  const [expiryChoice, setExpiryChoice] = useState<ExpiryChoice>('week');
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const reportDates = useMemo(() => {
    const from = startOfLocalDay(fromDate);
    const to = endOfLocalDay(toDate);
    const fromValid = !fromDate || !!from;
    const toValid = !toDate || !!to;
    const valid =
      fromValid &&
      toValid &&
      (!from || !to || new Date(from).getTime() <= new Date(to).getTime()) &&
      (!fromDate || !toDate || fromDate <= toDate);
    return { from, to, valid };
  }, [fromDate, toDate]);
  const merchantId = portal?.merchant?.id;

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextPortal, nextQrCodes] = await Promise.all([
        getMerchantPortal(),
        listMerchantPortalQrCodes().catch((reason: unknown) => {
          if (
            reason instanceof ApiError &&
            (reason.status === 403 || reason.status === 404)
          ) {
            return [];
          }
          throw reason;
        }),
      ]);
      setPortal(nextPortal);
      setQrCodes(nextPortal.merchant ? nextQrCodes : []);
    } catch (reason) {
      setError(safeError(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void loadDashboard(), 0);
    return () => clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    if (!reportDates.valid || !merchantId) return;
    let active = true;
    const timer = setTimeout(() => {
      void getMerchantPortal({ from: reportDates.from, to: reportDates.to })
        .then((result) => {
          if (active) setPortal(result);
        })
        .catch((reason: unknown) => {
          if (active) setError(safeError(reason));
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [merchantId, reportDates]);

  useEffect(() => {
    if (tab !== 'transactions' || !merchantId || !reportDates.valid) return;
    let active = true;
    const timer = setTimeout(() => {
      setTransactionsLoading(true);
      const filters: MerchantPortalFilters = {
        page,
        pageSize: 20,
        from: reportDates.from,
        to: reportDates.to,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        channel: channelFilter || undefined,
      };
      void listMerchantPortalTransactions(filters)
        .then((result) => {
          if (!active) return;
          setTransactions(result.items);
          setTotalTransactions(result.total);
        })
        .catch((reason: unknown) => {
          if (active) setError(safeError(reason));
        })
        .finally(() => {
          if (active) setTransactionsLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    tab,
    merchantId,
    page,
    reportDates,
    search,
    statusFilter,
    typeFilter,
    channelFilter,
  ]);

  const runOperation = useCallback(async (action: () => Promise<void>) => {
    setOperationBusy(true);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(safeError(reason));
    } finally {
      setOperationBusy(false);
    }
  }, []);

  const createQr = (kind: 'static' | 'fixed') =>
    runOperation(async () => {
      const expiresAt =
        expiryChoice === 'none'
          ? undefined
          : new Date(
              Date.now() +
                ({ day: 1, week: 7, month: 30 }[expiryChoice] ?? 0) *
                  24 *
                  60 *
                  60 *
                  1000,
            ).toISOString();
      let created: NewQr;
      if (kind === 'static') {
        created = await createMerchantStaticQr({ expiresAt });
      } else {
        const amount = Number(fixedAmount);
        if (!Number.isSafeInteger(amount) || amount <= 0) {
          throw new Error('Enter a valid whole-number amount.');
        }
        created = await createMerchantFixedQr({
          amount,
          reusable: fixedReusable,
          expiresAt,
        });
      }
      setNewQr(created);
      setFixedAmount('');
      setQrCodes(await listMerchantPortalQrCodes());
    });

  const cancelQr = (qrId: string) =>
    runOperation(async () => {
      await revokeMerchantQr(qrId);
      setConfirmRevoke(null);
      if (newQr?.id === qrId) setNewQr(null);
      setQrCodes(await listMerchantPortalQrCodes());
    });

  const selectTransaction = async (transaction: MerchantPortalTransaction) => {
    setDetailLoading(true);
    setSelectedTransaction(null);
    try {
      setSelectedTransaction(await getMerchantPortalTransaction(transaction.id));
    } catch (reason) {
      setError(safeError(reason));
    } finally {
      setDetailLoading(false);
    }
  };

  const exportCsv = () =>
    runOperation(async () => {
      const blob = await exportMerchantPortalTransactions({
        from: reportDates.from,
        to: reportDates.to,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        channel: channelFilter || undefined,
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'mori-merchant-transactions.csv';
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    });

  const getQrDataUrl = (): Promise<string> =>
    new Promise((resolve, reject) => {
      const qr = qrRef.current;
      if (!qr?.toDataURL) {
        reject(new Error('The QR image is not ready yet.'));
        return;
      }
      qr.toDataURL((data) => {
        if (data.startsWith('data:')) resolve(data);
        else resolve(`data:image/png;base64,${data}`);
      });
    });

  const downloadQr = async () => {
    if (!newQr || Platform.OS !== 'web') return;
    try {
      const dataUrl = await getQrDataUrl();
      const anchor = document.createElement('a');
      anchor.href = dataUrl;
      anchor.download = `mori-merchant-${newQr.kind}-qr.png`;
      anchor.click();
    } catch (reason) {
      setError(safeError(reason));
    }
  };

  const printQr = async () => {
    if (!newQr) return;
    const printWindow = Platform.OS === 'web' ? window.open('', '_blank') : null;
    try {
      const dataUrl = await getQrDataUrl();
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Mori Pay QR</title>
        <style>body{font-family:Arial,sans-serif;text-align:center;padding:32px;color:#07162e}
        img{width:320px;height:320px}p{color:#475569}</style></head>
        <body><h1>Mori Pay</h1><img src="${dataUrl}" alt="Merchant payment QR code">
        <p>${escapeHtml(portal?.merchant?.name ?? 'Merchant')}</p></body></html>`;
      if (Platform.OS === 'web') {
        if (!printWindow) throw new Error('Allow pop-ups to print this QR code.');
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        return;
      }
      const file = await Print.printToFileAsync({ html });
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('QR PDF was created, but file sharing is unavailable.');
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf' });
    } catch (reason) {
      printWindow?.close();
      setError(safeError(reason));
    }
  };

  const printReceipt = async () => {
    const transaction = selectedTransaction;
    if (!transaction || transaction.status !== 'completed' || !portal?.merchant) return;
    const html = receiptHtml(portal.merchant.name, transaction);
    if (Platform.OS === 'web') {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setError('Allow pop-ups to print or save the receipt as PDF.');
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }
    try {
      const file = await Print.printToFileAsync({ html });
      if (!(await Sharing.isAvailableAsync())) {
        setError('Receipt PDF was created, but file sharing is unavailable.');
        return;
      }
      await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf' });
    } catch (reason) {
      setError(safeError(reason));
    }
  };

  const setPreset = (days: number | null) => {
    setToDate(localDateValue(new Date()));
    setFromDate(
      days == null
        ? ''
        : localDateValue(new Date(todayEpoch - (days - 1) * 24 * 60 * 60 * 1000)),
    );
  };

  const styles = useMemo(
    () => createStyles(colors, radius, space, wide),
    [colors, radius, space, wide],
  );
  const merchant = portal?.merchant;
  const report = portal?.report;
  const pageCount = Math.max(1, Math.ceil(totalTransactions / 20));
  const datesInvalid = !reportDates.valid;

  const card = (children: ReactNode, extraStyle?: object) => (
    <View style={[styles.card, extraStyle]}>{children}</View>
  );

  const dateRange = (
    <View style={styles.dateRange}>
      <View style={styles.dateField}>
        <AppText variant="caption" color={colors.textSecondary}>From (Dar es Salaam)</AppText>
        <TextInput
          accessibilityLabel="Report start date"
          value={fromDate}
          onChangeText={setFromDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.dateField}>
        <AppText variant="caption" color={colors.textSecondary}>To (Dar es Salaam)</AppText>
        <TextInput
          accessibilityLabel="Report end date"
          value={toDate}
          onChangeText={setToDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
          style={styles.input}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.presetGroup}>
        {[
          { label: '7 days', days: 7 },
          { label: '30 days', days: 30 },
          { label: '90 days', days: 90 },
          { label: 'All time', days: null },
        ].map(({ label, days }) => (
          <Pressable
            accessibilityRole="button"
            key={label}
            onPress={() => setPreset(days)}
            style={styles.presetButton}>
            <AppText variant="caption" color={colors.primary}>{label}</AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const transactionRow = (transaction: MerchantPortalTransaction) => (
    <Pressable
      accessibilityRole="button"
      key={transaction.id}
      onPress={() => void selectTransaction(transaction)}
      style={({ pressed }) => [styles.transactionRow, pressed && styles.pressed]}>
      <View style={styles.transactionIdentity}>
        <AppText variant="bodySmallStrong">{transaction.reference}</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {displayDate(transaction.settledAt ?? transaction.createdAt)}
        </AppText>
      </View>
      <AppText variant="bodySmallStrong" numeric>
        {money(transaction.merchantAmount, transaction.currency)}
      </AppText>
      <View style={styles.statusPill}>
        <AppText variant="caption" color={statusColor(transaction.status, colors)}>
          {STATUS_LABELS[transaction.status] ?? 'Unknown'}
        </AppText>
      </View>
    </Pressable>
  );

  const receiptPanel = selectedTransaction ? (
    card(
      <>
        <View style={styles.rowBetween}>
          <AppText variant="title3">Transaction details</AppText>
          <Pressable accessibilityRole="button" onPress={() => setSelectedTransaction(null)}>
            <AppText variant="bodySmallStrong" color={colors.primary}>Close</AppText>
          </Pressable>
        </View>
        <View style={styles.receiptAmount}>
          <AppText variant="caption" color={colors.textSecondary}>Amount received by merchant</AppText>
          <AppText variant="amount" numeric>
            {money(selectedTransaction.merchantAmount, selectedTransaction.currency)}
          </AppText>
          <AppText variant="caption" color={statusColor(selectedTransaction.status, colors)}>
            {STATUS_LABELS[selectedTransaction.status] ?? 'Unknown status'}
          </AppText>
        </View>
        {[
          ['Payment reference', selectedTransaction.reference],
          ['Transaction ID', selectedTransaction.id],
          ['Customer transaction fee', money(selectedTransaction.fee, selectedTransaction.currency)],
          ['Customer total paid', money(selectedTransaction.total, selectedTransaction.currency)],
          ['Payment method', selectedTransaction.channel],
          ['Created', displayDate(selectedTransaction.createdAt)],
          ['Confirmed', displayDate(selectedTransaction.settledAt)],
        ].map(([label, value]) => (
          <View key={label} style={styles.detailRow}>
            <AppText variant="caption" color={colors.textSecondary}>{label}</AppText>
            <AppText variant="bodySmallStrong" style={styles.detailValue}>{value}</AppText>
          </View>
        ))}
        <AppText variant="caption" color={colors.textSecondary}>
          Merchant fee policy is not configured. The customer transaction fee shown here is not a merchant fee.
        </AppText>
        {selectedTransaction.status === 'completed' ? (
          <SecondaryButton
            label="Print / save receipt as PDF"
            block
            onPress={() => void printReceipt()}
          />
        ) : (
          <AppText variant="caption" color={colors.textSecondary}>
            A receipt is available only after the payment is confirmed.
          </AppText>
        )}
      </>,
      styles.detailCard,
    )
  ) : detailLoading ? card(<ActivityIndicator color={colors.primary} />) : null;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.pageContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.shell}>
          <View style={styles.header}>
            <View>
              <AppText variant="title2">Mori Pay</AppText>
              <AppText variant="caption" color={colors.textSecondary}>MERCHANT PORTAL</AppText>
            </View>
            <View style={styles.headerActions}>
              <AppText variant="caption" color={colors.textSecondary}>
                {user?.firstName ?? 'Merchant'}
              </AppText>
              <SecondaryButton label="Back to app" size="sm" onPress={() => router.replace('/(tabs)')} />
            </View>
          </View>

          <View style={styles.welcome}>
            <View>
              <AppText variant="title1">Business dashboard</AppText>
              <AppText variant="bodySmall" color={colors.textSecondary}>
                {merchant ? merchant.name : 'Application and account access'}
              </AppText>
            </View>
            {merchant ? (
              <View style={styles.accountStatus}>
                <View style={[styles.statusDot, { backgroundColor: statusColor(merchant.status, colors) }]} />
                <AppText variant="bodySmallStrong">{labelStatus(merchant.status)}</AppText>
              </View>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}>
            {(Object.keys(TAB_LABELS) as DashboardTab[]).map((name) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === name }}
                key={name}
                onPress={() => setTab(name)}
                style={[styles.tab, tab === name && styles.tabActive]}>
                <AppText
                  variant="bodySmallStrong"
                  color={tab === name ? colors.primary : colors.textSecondary}>
                  {TAB_LABELS[name]}
                </AppText>
              </Pressable>
            ))}
            <View style={styles.tabsFiller} />
            <SecondaryButton label="Refresh" size="sm" loading={loading} onPress={() => void loadDashboard()} />
          </ScrollView>

          {error ? (
            <View accessibilityRole="alert" style={styles.errorBox}>
              <AppText variant="bodySmall" color={colors.error}>{error}</AppText>
              <Pressable accessibilityRole="button" onPress={() => setError(null)}>
                <AppText variant="caption" color={colors.error}>Dismiss</AppText>
              </Pressable>
            </View>
          ) : null}

          {loading ? (
            card(
              <View style={styles.loading}>
                <ActivityIndicator color={colors.primary} />
                <AppText variant="bodySmall" color={colors.textSecondary}>Loading your merchant account…</AppText>
              </View>,
            )
          ) : !merchant ? (
            <ApplicationState
              application={portal?.application ?? null}
              onContinue={() => router.push('/merchant')}
              colors={colors}
              styles={styles}
            />
          ) : (
            <>
              {tab === 'overview' ? (
                <View style={styles.sectionStack}>
                  {dateRange}
                  {datesInvalid ? (
                    <AppText variant="caption" color={colors.error}>
                      Enter a valid date range. Dates use Dar es Salaam time.
                    </AppText>
                  ) : null}
                  <View style={styles.metricGrid}>
                    <MetricCard
                      label="Merchant ledger balance"
                      value={money(merchant.ledgerBalance, merchant.currency)}
                      note="Internal ledger balance; not a bank settlement."
                      colors={colors}
                      styles={styles}
                    />
                    <MetricCard
                      label="Received in selected period"
                      value={report ? money(report.grossReceived, merchant.currency) : '—'}
                      note="Confirmed credits posted to this merchant ledger."
                      colors={colors}
                      styles={styles}
                    />
                    <MetricCard
                      label="Completed payments"
                      value={report ? String(report.completedCount) : '—'}
                      note="Counted from ledger-linked transaction records."
                      colors={colors}
                      styles={styles}
                    />
                    <MetricCard
                      label="Pending / failed"
                      value={
                        report
                          ? report.pendingCount == null
                            ? 'Not tracked'
                            : String(report.pendingCount)
                          : '—'
                      }
                      note="Current merchant history stores posted ledger credits only."
                      colors={colors}
                      styles={styles}
                    />
                  </View>
                  {card(
                    <>
                      <View style={styles.rowBetween}>
                        <AppText variant="title3">Recent activity</AppText>
                        <Pressable accessibilityRole="button" onPress={() => setTab('transactions')}>
                          <AppText variant="bodySmallStrong" color={colors.primary}>All transactions</AppText>
                        </Pressable>
                      </View>
                      {portal?.recentTransactions.length ? (
                        portal.recentTransactions.map(transactionRow)
                      ) : (
                        <EmptyMessage text="No merchant payments have been recorded in this period." colors={colors} styles={styles} />
                      )}
                    </>,
                  )}
                </View>
              ) : null}

              {tab === 'transactions' ? (
                <View style={styles.sectionStack}>
                  {dateRange}
                  <View style={styles.filterGrid}>
                    <TextInput
                      accessibilityLabel="Search transaction reference or ID"
                      value={search}
                      onChangeText={(value) => {
                        setPage(1);
                        setSearch(value);
                      }}
                      placeholder="Search reference or transaction ID"
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.input, styles.searchInput]}
                    />
                    <FilterSelect
                      label="Status"
                      value={statusFilter}
                      onChange={(value) => { setPage(1); setStatusFilter(value); }}
                      options={[
                        ['', 'All statuses'],
                        ['completed', 'Completed'],
                        ['pending', 'Pending'],
                        ['processing', 'Processing'],
                        ['failed', 'Failed'],
                        ['cancelled', 'Cancelled'],
                      ]}
                      styles={styles}
                      colors={colors}
                    />
                    <FilterSelect
                      label="Type"
                      value={typeFilter}
                      onChange={(value) => { setPage(1); setTypeFilter(value); }}
                      options={[
                        ['', 'All types'],
                        ['payment', 'Payment'],
                      ]}
                      styles={styles}
                      colors={colors}
                    />
                    <FilterSelect
                      label="Method"
                      value={channelFilter}
                      onChange={(value) => { setPage(1); setChannelFilter(value); }}
                      options={[
                        ['', 'All methods'],
                        ['wallet', 'Mori Pay wallet'],
                      ]}
                      styles={styles}
                      colors={colors}
                    />
                  </View>
                  {datesInvalid ? (
                    <AppText variant="caption" color={colors.error}>
                      Enter a valid start and end date before searching.
                    </AppText>
                  ) : null}
                  <View style={styles.tableHeader}>
                    <AppText variant="caption" color={colors.textSecondary}>REFERENCE / DATE</AppText>
                    <AppText variant="caption" color={colors.textSecondary}>RECEIVED</AppText>
                    <AppText variant="caption" color={colors.textSecondary}>STATUS</AppText>
                  </View>
                  {transactionsLoading ? (
                    <View style={styles.loading}>
                      <ActivityIndicator color={colors.primary} />
                      <AppText variant="caption" color={colors.textSecondary}>Loading transactions…</AppText>
                    </View>
                  ) : transactions.length ? (
                    transactions.map(transactionRow)
                  ) : (
                    <EmptyMessage text="No transactions match these filters." colors={colors} styles={styles} />
                  )}
                  <View style={styles.rowBetween}>
                    <AppText variant="caption" color={colors.textSecondary}>
                      {totalTransactions.toLocaleString()} transactions · page {page} of {pageCount}
                    </AppText>
                    <View style={styles.pagination}>
                      <SecondaryButton
                        label="Previous"
                        size="sm"
                        disabled={page <= 1 || transactionsLoading}
                        onPress={() => setPage((current) => Math.max(1, current - 1))}
                      />
                      <SecondaryButton
                        label="Next"
                        size="sm"
                        disabled={page >= pageCount || transactionsLoading}
                        onPress={() => setPage((current) => Math.min(pageCount, current + 1))}
                      />
                    </View>
                  </View>
                  {receiptPanel}
                </View>
              ) : null}

              {tab === 'reports' ? (
                <View style={styles.sectionStack}>
                  {dateRange}
                  {datesInvalid ? (
                    <AppText variant="caption" color={colors.error}>
                      Enter a valid date range. Dates use Dar es Salaam time.
                    </AppText>
                  ) : null}
                  <View style={styles.metricGrid}>
                    <MetricCard label="Gross received" value={report ? money(report.grossReceived, merchant.currency) : '—'} note="Successful credits on the merchant ledger." colors={colors} styles={styles} />
                    <MetricCard label="Successful" value={report ? String(report.completedCount) : '—'} note="Confirmed merchant payments." colors={colors} styles={styles} />
                    <MetricCard label="Pending / processing" value={report ? report.pendingCount == null ? 'Not tracked' : String(report.pendingCount) : '—'} note="The backend does not store merchant-linked pending attempts." colors={colors} styles={styles} />
                    <MetricCard label="Failed / cancelled" value={report ? report.failedCount == null || report.cancelledCount == null ? 'Not tracked' : `${report.failedCount} / ${report.cancelledCount}` : '—'} note="Failed attempts are not linked to merchant ledger records." colors={colors} styles={styles} />
                  </View>
                  {card(
                    <>
                      <AppText variant="title3">Fees and settlement</AppText>
                      <AppText variant="bodySmall" color={colors.textSecondary}>
                        Customer transaction fees recorded: {report ? money(report.customerFees, merchant.currency) : '—'}.
                        This is the payer-side fee and is not a merchant fee.
                      </AppText>
                      <AppText variant="bodySmall" color={colors.textSecondary}>
                        Merchant fee policy has not been configured. Settlement or payout reporting is not available in the current backend.
                      </AppText>
                      <AppText variant="bodySmall" color={colors.textSecondary}>
                        Reversal and refund states are not represented in the current merchant transaction model.
                      </AppText>
                      <SecondaryButton
                        label="Export matching transactions to CSV"
                        block
                        loading={operationBusy}
                        disabled={datesInvalid || operationBusy}
                        onPress={() => void exportCsv()}
                      />
                    </>,
                  )}
                </View>
              ) : null}

              {tab === 'qr' ? (
                <View style={styles.sectionStack}>
                  <View style={styles.qrCreateGrid}>
                    {card(
                      <>
                        <AppText variant="title3">Create a static QR</AppText>
                        <AppText variant="bodySmall" color={colors.textSecondary}>
                          Customers enter the payment amount in Mori Pay.
                        </AppText>
                        <ExpiryPicker value={expiryChoice} onChange={setExpiryChoice} styles={styles} colors={colors} />
                        <Button
                          label="Create static QR"
                          block
                          loading={operationBusy}
                          disabled={operationBusy || merchant.status !== 'active'}
                          onPress={() => void createQr('static')}
                        />
                      </>,
                      styles.qrCreateCard,
                    )}
                    {card(
                      <>
                        <AppText variant="title3">Create fixed-amount QR</AppText>
                        <AppText variant="bodySmall" color={colors.textSecondary}>
                          Choose a one-time or reusable code and optional expiry.
                        </AppText>
                        <TextInput
                          accessibilityLabel="Fixed QR amount in TZS"
                          value={fixedAmount}
                          onChangeText={setFixedAmount}
                          placeholder="Amount in TZS"
                          placeholderTextColor={colors.textTertiary}
                          keyboardType="number-pad"
                          style={styles.input}
                        />
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: fixedReusable }}
                          onPress={() => setFixedReusable((current) => !current)}
                          style={styles.checkRow}>
                          <View style={[styles.checkbox, fixedReusable && styles.checkboxChecked]} />
                          <AppText variant="bodySmall">Reusable until expired or cancelled</AppText>
                        </Pressable>
                        <ExpiryPicker value={expiryChoice} onChange={setExpiryChoice} styles={styles} colors={colors} />
                        <Button
                          label="Create fixed QR"
                          block
                          loading={operationBusy}
                          disabled={operationBusy || merchant.status !== 'active' || !fixedAmount}
                          onPress={() => void createQr('fixed')}
                        />
                      </>,
                      styles.qrCreateCard,
                    )}
                  </View>
                  {merchant.status !== 'active' ? (
                    <View style={styles.infoBox}>
                      <AppText variant="bodySmall" color={colors.textSecondary}>
                        QR creation is disabled while this merchant account is {labelStatus(merchant.status).toLowerCase()}.
                      </AppText>
                    </View>
                  ) : null}
                  {newQr ? (
                    card(
                      <View style={styles.newQr}>
                        <AppText variant="title3">New QR code — save it now</AppText>
                        <AppText variant="caption" color={colors.textSecondary}>
                          The secure QR value is shown only once. Mori Pay stores a hash, so it cannot be recovered after leaving this screen.
                        </AppText>
                        <View style={styles.qrFrame}>
                          <QRCode
                            value={newQr.code}
                            size={220}
                            backgroundColor="#FFFFFF"
                            color="#07162E"
                            getRef={(instance) => { qrRef.current = instance; }}
                          />
                        </View>
                        <AppText variant="caption" style={styles.codeText} selectable>
                          {newQr.code}
                        </AppText>
                        <View style={styles.actionRow}>
                          {Platform.OS === 'web' ? (
                            <SecondaryButton label="Download PNG" onPress={() => void downloadQr()} />
                          ) : null}
                          <SecondaryButton label="Print QR" onPress={() => void printQr()} />
                          <DangerButton
                            label="Cancel this QR"
                            disabled={operationBusy}
                            onPress={() => setConfirmRevoke(newQr.id)}
                          />
                        </View>
                        {confirmRevoke === newQr.id ? (
                          <ConfirmBox
                            message="Cancel this QR code? Customers will no longer be able to pay with it."
                            onCancel={() => setConfirmRevoke(null)}
                            onConfirm={() => void cancelQr(newQr.id)}
                            busy={operationBusy}
                            styles={styles}
                            colors={colors}
                          />
                        ) : null}
                      </View>,
                    )
                  ) : null}
                  {card(
                    <>
                      <AppText variant="title3">QR code history</AppText>
                      <AppText variant="caption" color={colors.textSecondary}>
                        Previously created QR secrets cannot be retrieved; only their status and setup details are stored.
                      </AppText>
                      {qrCodes.length ? qrCodes.map((qr) => (
                        <View key={qr.id} style={styles.qrRow}>
                          <View style={styles.qrRowMain}>
                            <AppText variant="bodySmallStrong">
                              {qr.kind === 'static' ? 'Static payment QR' : 'Fixed-amount QR'}
                              {qr.amount != null ? ` · ${money(qr.amount, merchant.currency)}` : ''}
                            </AppText>
                            <AppText variant="caption" color={colors.textSecondary}>
                              {qr.reusable ? 'Reusable' : 'One-time'} · {qr.uses} use{qr.uses === 1 ? '' : 's'} · created {displayDate(qr.createdAt)}
                            </AppText>
                            <AppText variant="caption" color={colors.textSecondary}>
                              {qr.expiresAt ? `Expires ${displayDate(qr.expiresAt)}` : 'No expiry'} · {qrState(qr)}
                            </AppText>
                          </View>
                          {qrState(qr) === 'Active' ? (
                            <DangerButton
                              label="Cancel"
                              size="sm"
                              disabled={operationBusy}
                              onPress={() => setConfirmRevoke(qr.id)}
                            />
                          ) : null}
                          {confirmRevoke === qr.id ? (
                            <ConfirmBox
                              message="Cancel this QR code?"
                              onCancel={() => setConfirmRevoke(null)}
                              onConfirm={() => void cancelQr(qr.id)}
                              busy={operationBusy}
                              styles={styles}
                              colors={colors}
                            />
                          ) : null}
                        </View>
                      )) : (
                        <EmptyMessage text="No QR codes have been created yet." colors={colors} styles={styles} />
                      )}
                    </>,
                  )}
                </View>
              ) : null}

              {tab === 'business' ? (
                <View style={styles.sectionStack}>
                  {card(
                    <>
                      <AppText variant="title3">Business identity</AppText>
                      <BusinessRow label="Business name" value={merchant.name} styles={styles} colors={colors} />
                      <BusinessRow label="Merchant ID" value={merchant.identifier} styles={styles} colors={colors} />
                      <BusinessRow label="Category" value={merchant.category} styles={styles} colors={colors} />
                      <BusinessRow label="Contact phone" value={merchant.phone || 'Not provided'} styles={styles} colors={colors} />
                      <BusinessRow label="Application status" value={labelStatus(portal?.application?.status ?? 'unknown')} styles={styles} colors={colors} />
                      <BusinessRow label="Account status" value={labelStatus(merchant.status)} styles={styles} colors={colors} />
                      <BusinessRow label="Approved on" value={displayDate(merchant.approvedAt)} styles={styles} colors={colors} />
                      <AppText variant="caption" color={colors.textSecondary}>
                        Business identity changes, notification preferences, and payout settings are not currently supported by the backend. Contact Mori Pay support to request an approved change.
                      </AppText>
                    </>,
                  )}
                  {portal?.application?.reviewNote ? card(
                    <>
                      <AppText variant="title3">Review note</AppText>
                      <AppText variant="bodySmall" color={colors.textSecondary}>
                        {portal.application.reviewNote}
                      </AppText>
                    </>,
                  ) : null}
                </View>
              ) : null}
            </>
          )}
          <AppText variant="caption" color={colors.textSecondary} style={styles.footer}>
            Mori Pay · Merchant data is available only to the authenticated account owner.
          </AppText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ApplicationState({
  application,
  onContinue,
  colors,
  styles,
}: {
  application: MerchantPortal['application'];
  onContinue: () => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
}) {
  if (!application) {
    return (
      <View style={styles.sectionStack}>
        <View style={styles.card}>
          <AppText variant="title3">No merchant application yet</AppText>
          <AppText variant="bodySmall" color={colors.textSecondary}>
            Apply for a merchant account in Mori Pay. Dashboard and payment features are enabled only after approval.
          </AppText>
          <SecondaryButton label="Continue merchant setup" onPress={onContinue} />
        </View>
      </View>
    );
  }
  const status = application.status;
  const message: Record<typeof status, string> = {
    pending_payment: 'Your application is saved. Complete any configured registration-fee step in Mori Pay.',
    awaiting_review: 'Your application is awaiting review. Merchant tools will be enabled after approval.',
    approved: 'Your application is approved, but no active merchant account is currently available. Contact Mori Pay support.',
    rejected: application.reviewNote
      ? `The application was not approved. Review note: ${application.reviewNote}`
      : 'The application was not approved. Contact Mori Pay support for the next steps.',
  };
  return (
    <View style={styles.sectionStack}>
      <View style={styles.card}>
        <AppText variant="title3">{application.businessName}</AppText>
        <AppText variant="bodySmall" color={colors.textSecondary}>{application.category}</AppText>
        <View style={styles.accountStatus}>
          <View style={[styles.statusDot, { backgroundColor: statusColor(status, colors) }]} />
          <AppText variant="bodySmallStrong">{labelStatus(status)}</AppText>
        </View>
        <AppText variant="bodySmall" color={colors.textSecondary}>{message[status]}</AppText>
        {status === 'pending_payment' || status === 'rejected' ? (
          <SecondaryButton label="Continue merchant setup" onPress={onContinue} />
        ) : null}
      </View>
    </View>
  );
}

function MetricCard({
  label,
  value,
  note,
  colors,
  styles,
}: {
  label: string;
  value: string;
  note: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.metricCard}>
      <AppText variant="caption" color={colors.textSecondary}>{label}</AppText>
      <AppText variant="title2" numeric style={styles.metricValue}>{value}</AppText>
      <AppText variant="caption" color={colors.textSecondary}>{note}</AppText>
    </View>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  styles,
  colors,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  return (
    <View style={styles.filterField}>
      <AppText variant="caption" color={colors.textSecondary}>{label}</AppText>
      <View style={styles.filterOptions}>
        {options.map(([option, text]) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: value === option }}
            key={text}
            onPress={() => onChange(option)}
            style={[styles.filterOption, value === option && styles.filterOptionActive]}>
            <AppText variant="caption" color={value === option ? colors.primary : colors.textSecondary}>
              {text}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ExpiryPicker({
  value,
  onChange,
  styles,
  colors,
}: {
  value: ExpiryChoice;
  onChange: (choice: ExpiryChoice) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const choices: [ExpiryChoice, string][] = [
    ['none', 'No expiry'],
    ['day', '1 day'],
    ['week', '7 days'],
    ['month', '30 days'],
  ];
  return (
    <View style={styles.expiryGroup}>
      <AppText variant="caption" color={colors.textSecondary}>Expiry</AppText>
      <View style={styles.filterOptions}>
        {choices.map(([choice, label]) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: value === choice }}
            key={choice}
            onPress={() => onChange(choice)}
            style={[styles.filterOption, value === choice && styles.filterOptionActive]}>
            <AppText variant="caption" color={value === choice ? colors.primary : colors.textSecondary}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function ConfirmBox({
  message,
  onCancel,
  onConfirm,
  busy,
  styles,
  colors,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  return (
    <View style={styles.confirmBox}>
      <AppText variant="caption" color={colors.error}>{message}</AppText>
      <View style={styles.actionRow}>
        <SecondaryButton label="Keep QR" size="sm" disabled={busy} onPress={onCancel} />
        <DangerButton label="Confirm cancel" size="sm" loading={busy} onPress={onConfirm} />
      </View>
    </View>
  );
}

function BusinessRow({
  label,
  value,
  styles,
  colors,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  return (
    <View style={styles.detailRow}>
      <AppText variant="caption" color={colors.textSecondary}>{label}</AppText>
      <AppText variant="bodySmallStrong" style={styles.detailValue}>{value}</AppText>
    </View>
  );
}

function EmptyMessage({
  text,
  colors,
  styles,
}: {
  text: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.emptyState}>
      <AppText variant="bodySmall" color={colors.textSecondary} align="center">{text}</AppText>
    </View>
  );
}

function labelStatus(status: string): string {
  return status
    .split('_')
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function statusColor(status: string, colors: ReturnType<typeof useAppTheme>['colors']): string {
  if (status === 'completed' || status === 'active' || status === 'approved') return colors.success;
  if (status === 'failed' || status === 'cancelled' || status === 'rejected' || status === 'revoked') {
    return colors.error;
  }
  if (status === 'suspended') return colors.warning;
  return colors.primary;
}

function createStyles(
  colors: ReturnType<typeof useAppTheme>['colors'],
  radius: ReturnType<typeof useAppTheme>['radius'],
  space: ReturnType<typeof useAppTheme>['space'],
  wide: boolean,
) {
  return StyleSheet.create({
    safeArea: { flex: 1 },
    pageContent: { flexGrow: 1, alignItems: 'center', paddingHorizontal: wide ? 28 : 14, paddingVertical: 16 },
    shell: { width: '100%', maxWidth: 1320, gap: 18, paddingBottom: 36 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    welcome: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
    accountStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill },
    statusDot: { width: 8, height: 8, borderRadius: radius.pill },
    tabs: { flexGrow: 1, alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingBottom: 10 },
    tab: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill },
    tabActive: { backgroundColor: colors.primarySoft },
    tabsFiller: { flex: 1, minWidth: 12 },
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: wide ? 22 : 16, gap: 14 },
    detailCard: { marginTop: 12 },
    sectionStack: { gap: 16 },
    metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    metricCard: { flexBasis: wide ? '23%' : '47%', flexGrow: 1, minWidth: 145, padding: 16, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface, gap: 8 },
    metricValue: { fontSize: wide ? 25 : 21, lineHeight: wide ? 32 : 27 },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
    loading: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
    dateRange: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10, padding: 14, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius.lg },
    dateField: { flexGrow: 1, flexBasis: wide ? 150 : 135, gap: 5 },
    input: { minHeight: 44, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: 12, color: colors.text, fontSize: 14 },
    presetGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    presetButton: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.primarySoft },
    filterGrid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: 12 },
    searchInput: { flexGrow: 1, flexBasis: 240 },
    filterField: { gap: 6 },
    filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    filterOption: { paddingHorizontal: 9, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
    filterOptionActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
    tableHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingTop: 10 },
    transactionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 14, paddingHorizontal: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    transactionIdentity: { flex: 1, gap: 4 },
    statusPill: { paddingVertical: 4, paddingHorizontal: 9, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
    pressed: { opacity: 0.65 },
    pagination: { flexDirection: 'row', gap: 8 },
    receiptAmount: { alignItems: 'center', gap: 6, paddingVertical: 12 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
    detailValue: { textAlign: 'right', maxWidth: '65%' },
    qrCreateGrid: { flexDirection: wide ? 'row' : 'column', alignItems: 'stretch', gap: 14 },
    qrCreateCard: { flex: 1 },
    checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: colors.borderStrong },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    expiryGroup: { gap: 6 },
    newQr: { alignItems: 'center', gap: 12 },
    qrFrame: { padding: 14, backgroundColor: '#FFFFFF', borderRadius: radius.md },
    codeText: { textAlign: 'center', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
    actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
    qrRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
    qrRowMain: { flex: 1, minWidth: 220, gap: 5 },
    confirmBox: { width: '100%', borderRadius: radius.md, padding: 12, backgroundColor: colors.errorSoft, gap: 10 },
    infoBox: { borderRadius: radius.md, padding: 14, backgroundColor: colors.surfaceMuted },
    emptyState: { alignItems: 'center', justifyContent: 'center', minHeight: 100, padding: 18 },
    errorBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.errorSoft },
    footer: { textAlign: 'center', paddingTop: 12 },
  });
}
