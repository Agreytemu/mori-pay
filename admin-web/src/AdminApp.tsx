import { useCallback, useEffect, useState } from 'react';

import {
  AdminApiError,
  clearSession,
  getSignedInFirstName,
  hasSession,
  signIn,
  signOut,
  verifyAdminSession,
} from './api';
import { AdminShell } from './components/AdminShell';
import type { AdminTab } from './components/AdminShell';
import { AuditPage } from './components/AuditPage';
import { HealthPage } from './components/HealthPage';
import { KycReviewPage } from './components/KycReviewPage';
import { LoginPage } from './components/LoginPage';
import { MerchantOperationsPage } from './components/MerchantOperationsPage';
import { OverviewPage } from './components/OverviewPage';
import { PromotionsPage } from './components/PromotionsPage';
import { PushNotificationsPrompt } from './components/PushNotificationsPrompt';
import { ReconciliationPage } from './components/ReconciliationPage';
import { ReportsPage } from './components/ReportsPage';
import { SessionsPage } from './components/SessionsPage';
import { SystemSettingsPage } from './components/SystemSettingsPage';
import { StaffAccessPage } from './components/StaffAccessPage';
import { TransactionSearchPage } from './components/TransactionSearchPage';
import { UserSearchPage } from './components/UserSearchPage';
import { WebhooksPage } from './components/WebhooksPage';
import type { AdminSession } from './types';

type ViewState = 'checking' | 'signed-out' | 'authorized';

function errorMessage(error: unknown): string {
  if (!(error instanceof AdminApiError)) {
    return 'Mori Pay could not complete the request. Please try again.';
  }
  if (error.status === 0) {
    return 'Could not connect to Mori Pay. Check the API configuration and connection.';
  }
  if (error.status === 401) return 'Email or password is incorrect, or your session expired.';
  if (error.status === 403) return 'This account is not authorized to access the admin console.';
  if (error.status === 429) return 'Too many attempts. Wait a moment and try again.';
  if (error.status >= 500) return 'Mori Pay is temporarily unavailable. Try again shortly.';
  return 'Mori Pay could not verify this request. Please try again.';
}

export function AdminApp() {
  const [view, setView] = useState<ViewState>(() => hasSession() ? 'checking' : 'signed-out');
  const [firstName, setFirstName] = useState(getSignedInFirstName);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  const verify = useCallback(async () => {
    try {
      const verified = await verifyAdminSession();
      setSession(verified);
      setFirstName(getSignedInFirstName());
      setView('authorized');
      return true;
    } catch (failure) {
      clearSession();
      setSession(null);
      setView('signed-out');
      setError(failure instanceof AdminApiError && failure.status === 403
        ? 'This account is not authorized to access the admin console.'
        : errorMessage(failure));
      return false;
    }
  }, []);

  useEffect(() => {
    if (view === 'checking') void verify();
  }, [view, verify]);

  useEffect(() => {
    if (
      session &&
      new URLSearchParams(window.location.search).get('tab') === 'transactions' &&
      (session.staffRole === 'super_admin' ||
        session.capabilities.includes('admin:transaction:read'))
    ) {
      setActiveTab('transactions');
    }
  }, [session]);

  async function handleSignIn(email: string, password: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const verified = await signIn(email, password);
      setSession(verified);
      setFirstName(getSignedInFirstName());
      setView('authorized');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    let logoutError = '';
    try {
      await signOut();
    } catch {
      logoutError = 'Signed out on this device, but Mori Pay could not confirm remote session revocation.';
    }
    setSession(null);
    setView('signed-out');
    setError(logoutError);
  }

  if (view === 'checking') {
    return <main className="checking-screen" role="status">Verifying Mori Pay admin access…</main>;
  }

  if (view === 'signed-out' || !session) {
    return (
      <LoginPage
        error={error}
        busy={busy}
        onSignIn={handleSignIn}
        onClearError={() => setError('')}
      />
    );
  }

  const isSuperAdmin = session.staffRole === 'super_admin';
  const can = (capability: Parameters<typeof session.capabilities.includes>[0]) =>
    isSuperAdmin || session.capabilities.includes(capability);

  return (
    <AdminShell
      firstName={firstName}
      capabilities={session.capabilities}
      staffRole={session.staffRole}
      activeTab={activeTab}
      onTab={setActiveTab}
      onSignOut={() => void handleSignOut()}
    >
      <PushNotificationsPrompt />
      {activeTab === 'overview' ? <OverviewPage /> : null}
      {activeTab === 'reports' && can('admin:report:read') ? <ReportsPage /> : null}
      {activeTab === 'users' && can('admin:user:read') ? <UserSearchPage canManage={can('admin:user:write')} canManageSessions={can('admin:session:write')} /> : null}
      {activeTab === 'verification' && can('admin:user:read') ? <KycReviewPage canReview={can('admin:user:write')} /> : null}
      {activeTab === 'transactions' && can('admin:transaction:read') ? (
        <TransactionSearchPage
          initialTransactionId={
            new URLSearchParams(window.location.search).get('transactionId') ?? undefined
          }
        />
      ) : null}
      {activeTab === 'reconciliation' && can('admin:reconciliation:read') ? <ReconciliationPage canRun={can('admin:reconciliation:write')} /> : null}
      {activeTab === 'webhooks' && can('admin:webhook:read') ? <WebhooksPage /> : null}
      {activeTab === 'merchants' && can('admin:merchant:read') ? <MerchantOperationsPage canEditFee={can('admin:settings:write')} /> : null}
      {activeTab === 'sessions' && can('admin:session:read') ? <SessionsPage /> : null}
      {activeTab === 'settings' && can('admin:settings:read') ? <SystemSettingsPage canEdit={can('admin:settings:write')} /> : null}
      {activeTab === 'staff' && can('admin:staff:manage') ? <StaffAccessPage currentUserId={session.userId} /> : null}
      {activeTab === 'audit' && can('admin:audit:read') ? <AuditPage /> : null}
      {activeTab === 'promotions' && can('admin:promotion:read') ? <PromotionsPage canManage={can('admin:promotion:write')} /> : null}
      {activeTab === 'health' && can('admin:health:read') ? <HealthPage /> : null}
    </AdminShell>
  );
}
