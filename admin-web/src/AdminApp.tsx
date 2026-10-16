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
import { LoginPage } from './components/LoginPage';
import { MerchantOperationsPage } from './components/MerchantOperationsPage';
import { OverviewPage } from './components/OverviewPage';
import { SystemSettingsPage } from './components/SystemSettingsPage';
import { StaffAccessPage } from './components/StaffAccessPage';
import { TransactionSearchPage } from './components/TransactionSearchPage';
import { UserSearchPage } from './components/UserSearchPage';
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

  return (
    <AdminShell
      firstName={firstName}
      capabilities={session.capabilities}
      staffRole={session.staffRole}
      activeTab={activeTab}
      onTab={setActiveTab}
      onSignOut={() => void handleSignOut()}
    >
      {activeTab === 'overview' ? <OverviewPage /> : null}
      {activeTab === 'users' && session.capabilities.includes('admin:user:read') ? <UserSearchPage /> : null}
      {activeTab === 'transactions' && session.capabilities.includes('admin:transaction:read') ? <TransactionSearchPage /> : null}
      {activeTab === 'merchants' && session.capabilities.includes('admin:merchant:read') ? <MerchantOperationsPage canEditFee={session.capabilities.includes('admin:settings:write')} /> : null}
      {activeTab === 'settings' && session.capabilities.includes('admin:settings:read') ? <SystemSettingsPage /> : null}
      {activeTab === 'staff' && session.capabilities.includes('admin:staff:manage') ? <StaffAccessPage currentUserId={session.userId} /> : null}
      {activeTab === 'audit' && session.capabilities.includes('admin:audit:read') ? <AuditPage /> : null}
    </AdminShell>
  );
}
