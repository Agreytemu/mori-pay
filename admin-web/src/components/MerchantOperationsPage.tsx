import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import {
  AdminApiError,
  getRegistrationFee,
  listMerchantAccounts,
  listMerchantApplications,
  reviewMerchantApplication,
  updateMerchantAccountStatus,
  updateRegistrationFee,
} from '../api';
import { Alert } from './Alert';
import type {
  AdminMerchantAccount,
  AdminMerchantAccountPage,
  AdminMerchantApplication,
  AdminMerchantApplicationPage,
  RegistrationFee,
} from '../types';

type View = 'applications' | 'accounts';

function requestError(error: unknown): string {
  if (error instanceof AdminApiError && error.status === 403) return 'Your account is not authorized for this merchant operation.';
  if (error instanceof AdminApiError && error.status === 409) return 'The merchant record changed. Refresh and review its current status.';
  if (error instanceof AdminApiError && error.status === 0) return 'Could not connect to Mori Pay. Check your connection.';
  return 'Mori Pay could not complete the request. Try again shortly.';
}

function labelStatus(status: string): string {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const BUSINESS_TYPE_LABELS: Record<string, string> = {
  sole_proprietor: 'Sole proprietor',
  partnership: 'Partnership',
  limited_company: 'Limited company',
  cooperative: 'Cooperative',
  other: 'Other',
};

function businessTypeLabel(type?: string): string | null {
  if (!type) return null;
  return BUSINESS_TYPE_LABELS[type] ?? labelStatus(type);
}

export function MerchantOperationsPage({ canEditFee }: { canEditFee: boolean }) {
  const [view, setView] = useState<View>('applications');
  const [applications, setApplications] = useState<AdminMerchantApplicationPage | null>(null);
  const [accounts, setAccounts] = useState<AdminMerchantAccountPage | null>(null);
  const [fee, setFee] = useState<RegistrationFee | null>(null);
  const [feeInput, setFeeInput] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [savingFee, setSavingFee] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [applicationPage, accountPage, registrationFee] = await Promise.all([
        listMerchantApplications(page, 10),
        listMerchantAccounts(page, 10),
        getRegistrationFee(),
      ]);
      setApplications(applicationPage);
      setAccounts(accountPage);
      setFee(registrationFee);
      setFeeInput(registrationFee.amount == null ? '' : String(registrationFee.amount));
    } catch (failure) {
      setError(requestError(failure));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  async function review(application: AdminMerchantApplication, decision: 'approved' | 'rejected') {
    if (application.status !== 'awaiting_review' || busyId) return;
    const confirmed = window.confirm(
      `${decision === 'approved' ? 'Approve' : 'Reject'} ${application.businessName}?`,
    );
    if (!confirmed) return;
    const reviewNote = window.prompt('Optional review note. Leave blank for no note.');
    if (reviewNote === null) return;
    setBusyId(application.id);
    setError('');
    try {
      await reviewMerchantApplication(application.id, decision, reviewNote.trim() || undefined);
      setNotice(`Application ${decision}.`);
      await load();
    } catch (failure) {
      setError(requestError(failure));
    } finally {
      setBusyId('');
    }
  }

  async function changeStatus(account: AdminMerchantAccount) {
    const nextStatus = account.status === 'active' ? 'suspended' : 'active';
    const confirmed = window.confirm(
      `${nextStatus === 'active' ? 'Reactivate' : 'Suspend'} ${account.name}?`,
    );
    if (!confirmed) return;
    const reason = window.prompt(`Enter a reason to ${nextStatus === 'active' ? 'reactivate' : 'suspend'} this merchant account.`);
    if (!reason?.trim()) {
      setError('A reason is required before changing merchant account status.');
      return;
    }
    setBusyId(account.id);
    setError('');
    try {
      await updateMerchantAccountStatus(account.id, nextStatus, reason.trim());
      setNotice(`Merchant account ${nextStatus}.`);
      await load();
    } catch (failure) {
      setError(requestError(failure));
    } finally {
      setBusyId('');
    }
  }

  async function saveFee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(feeInput);
    if (!Number.isSafeInteger(amount) || amount <= 0 || savingFee) {
      setError('Enter a whole TZS amount greater than zero.');
      return;
    }
    if (!window.confirm(`Set the merchant registration fee to TZS ${amount.toLocaleString()} for new applications?`)) return;
    setSavingFee(true);
    setError('');
    try {
      const updated = await updateRegistrationFee(amount);
      setFee(updated);
      setFeeInput(updated.amount == null ? '' : String(updated.amount));
      setNotice('Registration fee updated for new applications.');
    } catch (failure) {
      setError(requestError(failure));
    } finally {
      setSavingFee(false);
    }
  }

  const activePage = view === 'applications' ? applications : accounts;

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">MERCHANT OPERATIONS</p><h1>Merchant workspace</h1><p>Review paid applications and manage approved merchant accounts.</p></div>
        <button type="button" className="button button-secondary refresh-button" onClick={() => void load()} disabled={loading}>Refresh</button>
      </section>
      {error ? <Alert tone="error" onDismiss={() => setError('')}>{error}</Alert> : null}
      {notice ? <Alert tone="success" onDismiss={() => setNotice('')}>{notice}</Alert> : null}

      {canEditFee ? <section className="fee-panel">
        <div><p className="eyebrow">APPLICATION CONFIGURATION</p><h2>Registration fee</h2><p>Applies to new applications. Existing application amounts are preserved.</p></div>
        <form onSubmit={(event) => void saveFee(event)}>
          <label htmlFor="registration-fee">Amount (TZS)</label>
          <div className="fee-controls">
            <input id="registration-fee" type="number" min="1" step="1" max={Number.MAX_SAFE_INTEGER} value={feeInput} onChange={(event) => setFeeInput(event.target.value)} placeholder="Not configured" />
            <button className="button button-primary" type="submit" disabled={savingFee || loading}>{savingFee ? 'Saving…' : 'Save fee'}</button>
          </div>
          <small>Current fee: {fee?.amount == null ? 'Not configured' : `TZS ${fee.amount.toLocaleString()}`}</small>
        </form>
      </section> : null}

      <section className="data-panel">
        <div className="panel-heading">
          <div><h2>Merchant records</h2><p>Restricted to the records required for operations.</p></div>
          <div className="tab-switch" role="tablist" aria-label="Merchant records">
            <button type="button" role="tab" aria-selected={view === 'applications'} className={view === 'applications' ? 'selected' : ''} onClick={() => setView('applications')}>Applications</button>
            <button type="button" role="tab" aria-selected={view === 'accounts'} className={view === 'accounts' ? 'selected' : ''} onClick={() => setView('accounts')}>Accounts</button>
          </div>
        </div>
        {loading ? <div className="page-loading" role="status">Loading merchant records…</div> : null}
        {!loading && view === 'applications' ? (
          <ApplicationTable
            page={applications}
            busyId={busyId}
            onReview={review}
          />
        ) : null}
        {!loading && view === 'accounts' ? (
          <AccountTable page={accounts} busyId={busyId} onChangeStatus={changeStatus} />
        ) : null}
        <div className="pagination">
          <span>{activePage?.total.toLocaleString() ?? 0} records</span>
          <div><button type="button" className="button button-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {Math.max(1, activePage?.totalPages ?? 1)}</span><button type="button" className="button button-secondary" disabled={loading || page >= (activePage?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</button></div>
        </div>
      </section>
    </>
  );
}

function ApplicationTable({
  page,
  busyId,
  onReview,
}: {
  page: AdminMerchantApplicationPage | null;
  busyId: string;
  onReview: (application: AdminMerchantApplication, decision: 'approved' | 'rejected') => void;
}) {
  if (!page?.items.length) return <div className="table-empty">No merchant applications are waiting for review.</div>;
  return (
    <div className="table-scroll"><table><thead><tr><th>BUSINESS</th><th>APPLICANT</th><th>STATUS</th><th>FEE</th><th>SUBMITTED</th><th>ACTIONS</th></tr></thead>
      <tbody>{page.items.map((application) => <tr key={application.id}>
        <td>
          <strong>{application.businessName}</strong>
          <small>{[application.category, businessTypeLabel(application.businessType)].filter(Boolean).join(' · ')}</small>
          {application.region || application.district ? <small>{[application.region, application.district].filter(Boolean).join(' · ')}</small> : null}
          {application.tin || application.businessLicenceNumber ? (
            <small>
              {application.tin ? `TIN: ${application.tin}` : ''}
              {application.tin && application.businessLicenceNumber ? ' · ' : ''}
              {application.businessLicenceNumber ? `Licence: ${application.businessLicenceNumber}` : ''}
            </small>
          ) : null}
        </td>
        <td>{application.applicantName}<small>{application.applicantPhone ?? application.phone ?? 'Phone not provided'}</small></td>
        <td><span className={`record-status status-${application.status}`}>{labelStatus(application.status)}</span></td>
        <td>{application.registrationFeeAmount == null ? '—' : `TZS ${application.registrationFeeAmount.toLocaleString()}`}</td>
        <td>{new Date(application.createdAt).toLocaleDateString()}</td>
        <td>{application.status === 'awaiting_review' ? <div className="row-actions"><button type="button" className="action-button approve" disabled={Boolean(busyId)} onClick={() => onReview(application, 'approved')}>{busyId === application.id ? 'Saving…' : 'Approve'}</button><button type="button" className="action-button reject" disabled={Boolean(busyId)} onClick={() => onReview(application, 'rejected')}>Reject</button></div> : <span className="muted-text">Awaiting payment</span>}</td>
      </tr>)}</tbody>
    </table></div>
  );
}

function AccountTable({
  page,
  busyId,
  onChangeStatus,
}: {
  page: AdminMerchantAccountPage | null;
  busyId: string;
  onChangeStatus: (account: AdminMerchantAccount) => void;
}) {
  if (!page?.items.length) return <div className="table-empty">No merchant accounts are available.</div>;
  return (
    <div className="table-scroll"><table><thead><tr><th>MERCHANT</th><th>OWNER</th><th>STATUS</th><th>CREATED</th><th>ACTION</th></tr></thead>
      <tbody>{page.items.map((account) => <tr key={account.id}>
        <td><strong>{account.name}</strong><small>{account.category} · {account.identifier}</small></td>
        <td>{account.ownerName}<small>{account.ownerPhone ?? account.phone ?? 'Phone not provided'}</small></td>
        <td><span className={`record-status status-${account.status}`}>{labelStatus(account.status)}</span></td>
        <td>{new Date(account.createdAt).toLocaleDateString()}</td>
        <td>{account.status === 'revoked' ? <span className="muted-text">Revoked</span> : <button type="button" className="action-button" disabled={Boolean(busyId)} onClick={() => onChangeStatus(account)}>{busyId === account.id ? 'Saving…' : account.status === 'active' ? 'Suspend' : 'Reactivate'}</button>}</td>
      </tr>)}</tbody>
    </table></div>
  );
}
