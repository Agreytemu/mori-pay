import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import QRCode from 'qrcode';
import type { AuthSession, MerchantPortal, MerchantPortalQrCode, MerchantPortalTransaction, MerchantQrCode } from './types';
import {
  createFixedQr,
  createStaticQr,
  exportTransactions,
  getMerchantPortal,
  getTransaction,
  hasSession,
  getSignedInFirstName,
  listQrCodes,
  listTransactions,
  MerchantApiError,
  revokeQr,
  signIn,
  signOut,
  type TransactionFilters,
} from './api';
import { Alert } from './components/Feedback';
import { DateRange } from './components/DateRange';
import { TransactionModal } from './components/TransactionModal';
import { WorkspaceLayout, type WorkspaceTab } from './components/WorkspaceLayout';
import { ApplicationStatusPage } from './pages/ApplicationStatusPage';
import { BusinessPage } from './pages/BusinessPage';
import { LoginPage } from './pages/LoginPage';
import { LandingPage } from './pages/LandingPage';
import { OverviewPage } from './pages/OverviewPage';
import { QrCodesPage, type QrExpiry } from './pages/QrCodesPage';
import { ReportsPage } from './pages/ReportsPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { formatDate, formatMoney, shiftDate, todayInTanzania, toBoundary } from './utils/format';

function friendlyError(error: unknown): string {
  if (!(error instanceof MerchantApiError)) return 'Mori Pay could not complete the request. Try again.';
  if (error.status === 0) return 'Could not connect to Mori Pay. Check your connection and try again.';
  if (error.status === 401) return 'Your session has expired. Sign in again.';
  if (error.status === 403) return 'This account is not allowed to access that information.';
  if (error.status === 404) return 'The requested merchant record could not be found.';
  if (error.status === 409) return 'This request conflicts with the current account state. Refresh and try again.';
  if (error.status === 429) return 'Too many requests. Wait a moment and try again.';
  if (error.status >= 500) return 'Mori Pay could not complete the request. Try again shortly.';
  return 'Check the information and try again.';
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

export function MerchantApp() {
  const [authenticated, setAuthenticated] = useState(hasSession);
  const [showLanding, setShowLanding] = useState(!hasSession());
  const [firstName, setFirstName] = useState(() => getSignedInFirstName() ?? '');
  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [portal, setPortal] = useState<MerchantPortal | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [qrCodes, setQrCodes] = useState<MerchantPortalQrCode[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [from, setFrom] = useState(() => shiftDate(todayInTanzania(), -6));
  const [to, setTo] = useState(todayInTanzania());
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginMode, setLoginMode] = useState<'password' | 'pin'>('password');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [page, setPage] = useState(1);
  const [transactions, setTransactions] = useState<MerchantPortalTransaction[]>([]);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [selected, setSelected] = useState<MerchantPortalTransaction | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [qrKind, setQrKind] = useState<'static' | 'fixed'>('static');
  const [qrAmount, setQrAmount] = useState('');
  const [qrReusable, setQrReusable] = useState(false);
  const [qrExpiry, setQrExpiry] = useState<QrExpiry>('month');
  const [newQr, setNewQr] = useState<MerchantQrCode | null>(null);
  const [newQrImage, setNewQrImage] = useState('');
  const [revokeConfirm, setRevokeConfirm] = useState('');

  const merchant = portal?.merchant ?? null;
  const datesValid = Boolean(from && to && from <= to);
  const reportRange = useMemo(
    () => ({ from: toBoundary(from), to: toBoundary(to, true) }),
    [from, to],
  );
  const pageCount = Math.max(1, Math.ceil(transactionTotal / 20));

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextPortal = await getMerchantPortal({
        from: reportRange.from,
        to: reportRange.to,
      });
      setPortal(nextPortal);
      setLoaded(true);
      if (nextPortal.merchant?.status === 'active') {
        try {
          setQrCodes(await listQrCodes());
        } catch (reason) {
          if (
            reason instanceof MerchantApiError &&
            (reason.status === 403 || reason.status === 404)
          ) {
            setQrCodes([]);
          } else {
            throw reason;
          }
        }
      } else {
        setQrCodes([]);
      }
    } catch (reason) {
      setError(friendlyError(reason));
      if (reason instanceof MerchantApiError && reason.status === 401) {
        setAuthenticated(false);
        setLoaded(false);
      }
    } finally {
      setLoading(false);
    }
  }, [reportRange]);

  useEffect(() => {
    if (!authenticated || !datesValid) return;
    const timer = window.setTimeout(() => void loadDashboard(), 150);
    return () => window.clearTimeout(timer);
  }, [authenticated, datesValid, loadDashboard]);

  useEffect(() => {
    if (!authenticated || tab !== 'transactions' || !merchant || !datesValid) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setTransactionsLoading(true);
      const filters: TransactionFilters = {
        page,
        pageSize: 20,
        from: reportRange.from,
        to: reportRange.to,
        search: transactionSearch.trim() || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        channel: channelFilter || undefined,
      };
      void listTransactions(filters)
        .then((result) => {
          if (active) {
            setTransactions(result.items);
            setTransactionTotal(result.total);
          }
        })
        .catch((reason: unknown) => {
          if (active) setError(friendlyError(reason));
        })
        .finally(() => {
          if (active) setTransactionsLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    authenticated,
    channelFilter,
    datesValid,
    merchant,
    page,
    reportRange,
    statusFilter,
    tab,
    transactionSearch,
    typeFilter,
  ]);

  const onSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result: AuthSession = await signIn(
        loginMode === 'password'
          ? { mode: 'password', credentials: { email: loginEmail.trim(), password: loginPassword } }
          : { mode: 'pin', credentials: { email: loginEmail.trim(), pin: loginPin } },
      );
      setLoginPassword('');
      setLoginPin('');
      setFirstName(result.user.firstName);
      setAuthenticated(true);
      setNotice(`Welcome back, ${result.user.firstName}.`);
    } catch (reason) {
      setError(
        reason instanceof MerchantApiError && reason.status === 401
          ? 'The email or password/PIN did not match your Mori Pay account.'
          : friendlyError(reason),
      );
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = async () => {
    setBusy(true);
    try {
      await signOut();
    } catch {
      setError('You were signed out on this device, but Mori Pay could not confirm server logout.');
    } finally {
      setAuthenticated(false);
      setFirstName('');
      setShowLanding(true);
      setPortal(null);
      setLoaded(false);
      setQrCodes([]);
      setBusy(false);
      setNotice('');
    }
  };

  const createQr = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const days: Record<Exclude<QrExpiry, 'none'>, number> = { day: 1, week: 7, month: 30 };
      const expiresAt =
        qrExpiry === 'none'
          ? undefined
          : new Date(Date.now() + days[qrExpiry] * 24 * 60 * 60 * 1000).toISOString();
      const created =
        qrKind === 'static'
          ? await createStaticQr(expiresAt)
          : await createFixedQr({
              amount: Number(qrAmount),
              reusable: qrReusable,
              expiresAt,
            });
      setNewQr(created);
      setNewQrImage(await QRCode.toDataURL(created.code, { width: 360, margin: 2 }));
      setQrAmount('');
      setQrCodes(await listQrCodes());
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setBusy(false);
    }
  };

  const cancelQr = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      await revokeQr(id);
      setQrCodes(await listQrCodes());
      setRevokeConfirm('');
      setNotice('QR code cancelled.');
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setBusy(false);
    }
  };

  const openTransaction = async (transaction: MerchantPortalTransaction) => {
    setDetailLoading(true);
    setSelected(null);
    setError('');
    try {
      setSelected(await getTransaction(transaction.id));
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setDetailLoading(false);
    }
  };

  const downloadCsv = async () => {
    setBusy(true);
    setError('');
    try {
      const blob = await exportTransactions({
        from: reportRange.from,
        to: reportRange.to,
        search: transactionSearch.trim() || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        channel: channelFilter || undefined,
      });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = 'mori-merchant-transactions.csv';
      anchor.click();
      URL.revokeObjectURL(href);
    } catch (reason) {
      setError(friendlyError(reason));
    } finally {
      setBusy(false);
    }
  };

  const downloadQr = () => {
    if (!newQrImage || !newQr) return;
    const anchor = document.createElement('a');
    anchor.href = newQrImage;
    anchor.download = `mori-merchant-${newQr.kind}-qr.png`;
    anchor.click();
  };

  const printQr = () => {
    if (!newQrImage || !merchant) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Allow pop-ups to print this QR code.');
      return;
    }
    printWindow.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Mori Pay QR</title>
      <style>body{font:16px Inter,Arial,sans-serif;text-align:center;padding:32px;color:#12171f}
      img{width:320px;height:320px}p{color:#5b6575}</style></head>
      <body><h1>Mori Pay</h1><img src="${newQrImage}" alt="Merchant payment QR code">
      <p>${escapeHtml(merchant.name)}</p></body></html>`,
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const printReceipt = (transaction: MerchantPortalTransaction) => {
    if (!merchant || transaction.status !== 'completed') return;
    const receipt = window.open('', '_blank');
    if (!receipt) {
      setError('Allow pop-ups to print or save the receipt as PDF.');
      return;
    }
    receipt.document.write(
      `<!doctype html><html><head><title>Mori Pay receipt</title><style>
      body{font:16px Inter,Arial,sans-serif;color:#12171f;margin:36px}
      main{max-width:620px;margin:auto;border:1px solid #e4e7ec;border-radius:16px;padding:32px}
      h1{color:#0e7367;margin:0 0 6px}.muted{color:#5b6575}.amount{font-size:32px;font-weight:bold}
      table{width:100%;border-collapse:collapse;margin-top:24px}td{padding:12px 0;border-bottom:1px solid #e4e7ec}
      td:first-child{color:#5b6575}td:last-child{text-align:right;font-weight:600;word-break:break-word}
      footer{margin-top:26px;color:#5b6575;font-size:12px}
      </style></head><body><main><h1>Mori Pay</h1><p class="muted">Merchant payment receipt</p>
      <p>Received by</p><strong>${escapeHtml(merchant.name)}</strong>
      <p class="amount">${escapeHtml(formatMoney(transaction.merchantAmount, transaction.currency))}</p>
      <table>
      <tr><td>Reference</td><td>${escapeHtml(transaction.reference)}</td></tr>
      <tr><td>Transaction ID</td><td>${escapeHtml(transaction.id)}</td></tr>
      <tr><td>Amount received</td><td>${escapeHtml(formatMoney(transaction.merchantAmount, transaction.currency))}</td></tr>
      <tr><td>Customer transaction fee</td><td>${escapeHtml(formatMoney(transaction.fee, transaction.currency))}</td></tr>
      <tr><td>Customer total paid</td><td>${escapeHtml(formatMoney(transaction.total, transaction.currency))}</td></tr>
      <tr><td>Date and time (Dar es Salaam)</td><td>${escapeHtml(formatDate(transaction.settledAt ?? transaction.createdAt))}</td></tr>
      </table><footer>This receipt reflects the confirmed merchant ledger entry. It is not a bank settlement statement.</footer>
      </main></body></html>`,
    );
    receipt.document.close();
    receipt.focus();
    receipt.print();
  };

  if (!authenticated) {
    if (showLanding) {
      return (
        <LandingPage
          feedback={error ? <Alert tone="error" onDismiss={() => setError('')}>{error}</Alert> : null}
          onSignIn={() => { setShowLanding(false); setError(''); }}
        />
      );
    }
    return (
      <LoginPage
        error={error ? <Alert tone="error" onDismiss={() => setError('')}>{error}</Alert> : null}
        busy={busy}
        email={loginEmail}
        password={loginPassword}
        pin={loginPin}
        mode={loginMode}
        onEmail={setLoginEmail}
        onPassword={setLoginPassword}
        onPin={setLoginPin}
        onMode={(mode) => {
          setLoginMode(mode);
          setError('');
          setNotice('');
        }}
        onSubmit={onSignIn}
        onHome={() => { setShowLanding(true); setError(''); }}
      />
    );
  }

  const title = {
    overview: 'Overview',
    transactions: 'Transactions',
    reports: 'Reports',
    qr: 'QR code management',
    business: 'Business profile',
  }[tab];
  const subtitle = merchant?.name ?? portal?.application?.businessName ?? 'Merchant application and account';

  return (
    <>
      <WorkspaceLayout
        active={tab}
        merchantStatus={merchant?.status}
        title={title}
        subtitle={subtitle}
        loading={loading}
        busy={busy}
        onTab={setTab}
        onRefresh={() => void loadDashboard()}
        onSignOut={() => void onSignOut()}
      >
        <DateRange
          from={from}
          to={to}
          onFrom={(value) => { setPage(1); setFrom(value); }}
          onTo={(value) => { setPage(1); setTo(value); }}
        />
        {error ? <Alert tone="error" onDismiss={() => setError('')}>{error}</Alert> : null}
        {notice ? <Alert tone="success" onDismiss={() => setNotice('')}>{notice}</Alert> : null}
        {!datesValid ? (
          <Alert tone="error">Enter a valid start and end date. Dates use Dar es Salaam time.</Alert>
        ) : null}
        {!loaded && loading ? (
          <div className="loading-panel"><span className="loader" /><strong>Checking your Mori Pay account and merchant application…</strong></div>
        ) : !loaded ? (
          <div className="application-card">
            <span className="application-icon">!</span>
            <span className="eyebrow">ACCOUNT CHECK UNAVAILABLE</span>
            <h2>We could not verify your merchant status</h2>
            <p className="muted">
              Your application status was not assumed or changed. Check your
              connection and refresh to securely try again.
            </p>
            <button className="button button-primary" onClick={() => void loadDashboard()} disabled={loading}>
              Retry account check
            </button>
          </div>
        ) : !merchant ? (
          <ApplicationStatusPage application={portal?.application ?? null} />
        ) : merchant.status !== 'active' ? (
          <section className="restricted-card">
            <div className="restricted-symbol">!</div>
            <div>
              <h2>Merchant management is unavailable</h2>
              <p className="muted">
                Your merchant account is {merchant.status}. Payment, reporting
                and QR management are enabled only for active merchant
                accounts. Contact Mori Pay support if you believe this status
                is incorrect.
              </p>
            </div>
          </section>
        ) : (
          <>
            {tab === 'overview' ? (
              <OverviewPage
                portal={portal}
                firstName={firstName || 'there'}
                onTransactions={() => setTab('transactions')}
                onTransaction={(item) => void openTransaction(item)}
              />
            ) : null}
            {tab === 'transactions' ? (
              <TransactionsPage
                items={transactions}
                total={transactionTotal}
                page={page}
                pageCount={pageCount}
                loading={transactionsLoading}
                search={transactionSearch}
                status={statusFilter}
                type={typeFilter}
                channel={channelFilter}
                onSearch={(value) => { setPage(1); setTransactionSearch(value); }}
                onStatus={(value) => { setPage(1); setStatusFilter(value); }}
                onType={(value) => { setPage(1); setTypeFilter(value); }}
                onChannel={(value) => { setPage(1); setChannelFilter(value); }}
                onPage={setPage}
                onTransaction={(item) => void openTransaction(item)}
              />
            ) : null}
            {tab === 'reports' ? (
              <ReportsPage portal={portal} busy={busy} onExport={() => void downloadCsv()} />
            ) : null}
            {tab === 'qr' ? (
              <QrCodesPage
                codes={qrCodes}
                kind={qrKind}
                amount={qrAmount}
                reusable={qrReusable}
                expiry={qrExpiry}
                created={newQr}
                image={newQrImage}
                busy={busy}
                confirmId={revokeConfirm}
                onKind={setQrKind}
                onAmount={setQrAmount}
                onReusable={setQrReusable}
                onExpiry={setQrExpiry}
                onCreate={(event) => void createQr(event)}
                onConfirmId={setRevokeConfirm}
                onCancel={(id) => void cancelQr(id)}
                onDownload={downloadQr}
                onPrint={printQr}
                onDismissCreated={() => { setNewQr(null); setNewQrImage(''); }}
              />
            ) : null}
            {tab === 'business' ? <BusinessPage portal={portal} /> : null}
          </>
        )}
      </WorkspaceLayout>
      {detailLoading ? (
        <div className="modal-backdrop">
          <div className="modal-card loading-panel"><span className="loader" /><strong>Loading transaction…</strong></div>
        </div>
      ) : selected ? (
        <TransactionModal
          transaction={selected}
          onClose={() => setSelected(null)}
          onPrint={() => printReceipt(selected)}
        />
      ) : null}
    </>
  );
}
