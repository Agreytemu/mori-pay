import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  AdminApiError,
  getAdminUser,
  revokeAdminUserDevice,
  revokeAdminUserSessions,
  searchAdminUsers,
  updateAdminUserKyc,
  updateAdminUserStatus,
  updateAdminUserTier,
} from '../api';
import type { AdminUserDetail, AdminUserSearchPage } from '../types';

export function UserSearchPage({
  canManage,
  canManageSessions,
}: {
  canManage: boolean;
  canManageSessions: boolean;
}) {
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminUserSearchPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const [searchVersion, setSearchVersion] = useState(0);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const [statusValue, setStatusValue] = useState<'active' | 'pending' | 'restricted'>('active');
  const [tierValue, setTierValue] = useState<'Standard' | 'Verified'>('Standard');
  const [kycValue, setKycValue] = useState('0');
  const [reason, setReason] = useState('');
  const [manageBusy, setManageBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);

  const load = useCallback(async () => {
    if (!term) return;
    setLoading(true);
    setError('');
    try {
      setData(await searchAdminUsers(term, page));
    } catch (failure) {
      setError(failure instanceof AdminApiError && failure.status === 403
        ? 'Your account is not authorized to search customer records.'
        : 'Mori Pay could not load matching customers. Try again.');
    } finally {
      setLoading(false);
    }
  }, [page, searchVersion, term]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selectedUser) return;
    setStatusValue((selectedUser.status as typeof statusValue) ?? 'active');
    setTierValue((selectedUser.tier as typeof tierValue) ?? 'Standard');
    setKycValue(String(selectedUser.kycLevel));
    setReason('');
    setNotice('');
  }, [selectedUser]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = input.trim();
    if (normalized.length < 3 || normalized.length > 80) {
      setValidation('Enter at least 3 characters and no more than 80.');
      return;
    }
    setValidation('');
    setData(null);
    setSelectedUser(null);
    setPage(1);
    setTerm(normalized);
    setSearchVersion((version) => version + 1);
  }

  async function openDetails(userId: string) {
    setDetailLoading(true);
    setDetailError('');
    try {
      setSelectedUser(await getAdminUser(userId));
    } catch {
      setDetailError('Mori Pay could not load this customer record. Try again.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function runManage(action: () => Promise<unknown>, successMessage: string) {
    if (!selectedUser || manageBusy) return;
    setManageBusy(true);
    setNotice('');
    try {
      await action();
      setNoticeError(false);
      setNotice(successMessage);
      setSelectedUser(await getAdminUser(selectedUser.id));
    } catch (failure) {
      setNoticeError(true);
      setNotice(failure instanceof AdminApiError && failure.status === 403
        ? 'Your account is not authorized to change this customer.'
        : 'Mori Pay could not apply this change. Try again.');
    } finally {
      setManageBusy(false);
    }
  }

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">CUSTOMER OPERATIONS</p><h1>User search</h1><p>Find customer accounts using a name, phone, email, member ID, or exact account ID. Contact details are masked.</p></div>
      </section>
      <section className="data-panel">
        <form className="search-form" onSubmit={submit}>
          <label htmlFor="user-search">Search Mori Pay users</label>
          <div className="search-controls">
            <input id="user-search" autoComplete="off" maxLength={80} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Enter at least 3 characters" />
            <button className="button button-primary" type="submit" disabled={loading}>Search</button>
          </div>
          {validation ? <small className="search-validation" role="alert">{validation}</small> : null}
        </form>
        {loading ? <div className="page-loading" role="status">Searching customer records…</div> : null}
        {!loading && error ? <div className="page-error" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => void load()}>Retry</button></div> : null}
        {!loading && !error && term && data?.items.length === 0 ? <div className="table-empty">No matching customer accounts.</div> : null}
        {!loading && !error && data?.items.length ? (
          <div className="table-scroll"><table><thead><tr><th>CUSTOMER</th><th>CONTACT</th><th>MEMBER ID</th><th>STATUS</th><th>TIER / KYC</th><th>JOINED</th><th></th></tr></thead><tbody>
            {data.items.map((user) => <tr key={`${user.memberId}-${user.createdAt}`}><td><strong>{user.name}</strong></td><td>{user.phone ?? 'No phone'}<small>{user.email ?? 'No email'}</small></td><td>{user.memberId}</td><td><span className={`record-status status-${user.status}`}>{user.status}</span></td><td>{user.tier}<small>KYC level {user.kycLevel}</small></td><td>{new Date(user.createdAt).toLocaleDateString()}</td><td><button type="button" className="action-button" disabled={detailLoading} onClick={() => void openDetails(user.id)}>Details</button></td></tr>)}
          </tbody></table></div>
        ) : null}
        {detailLoading ? <div className="page-loading" role="status">Loading audited customer details…</div> : null}
        {detailError ? <div className="page-error" role="alert">{detailError}</div> : null}
        {selectedUser ? (
          <section className="detail-panel" aria-label="Customer details">
            <div className="detail-heading"><div><p className="eyebrow">AUDITED RECORD ACCESS</p><h2>{selectedUser.name}</h2></div><button className="button button-secondary" type="button" onClick={() => setSelectedUser(null)}>Close</button></div>
            <div className="detail-grid">
              <div><small>CONTACT</small><strong>{selectedUser.phone ?? 'No phone'} · {selectedUser.email ?? 'No email'}</strong></div>
              <div><small>ACCOUNT</small><strong>{selectedUser.status} · {selectedUser.tier} · KYC {selectedUser.kycLevel}</strong></div>
              <div><small>WALLET</small><strong>{selectedUser.wallet ? `${selectedUser.wallet.currency} · ${selectedUser.wallet.status} · ${selectedUser.wallet.accountNumber}` : 'No wallet account'}</strong></div>
              <div><small>SESSIONS</small><strong>{selectedUser.sessions.active} active · {selectedUser.sessions.revoked} revoked</strong></div>
            </div>

            {notice ? <p className={`inline-note ${noticeError ? 'error' : 'success'}`} role="status">{notice}</p> : null}

            {canManage ? (
              <div className="manage-section">
                <div className="detail-subheading">Account management</div>
                <div className="manage-row">
                  <label>Status<select value={statusValue} onChange={(event) => setStatusValue(event.target.value as typeof statusValue)}><option value="active">active</option><option value="pending">pending</option><option value="restricted">restricted</option></select></label>
                  <label>Tier<select value={tierValue} onChange={(event) => setTierValue(event.target.value as typeof tierValue)}><option value="Standard">Standard</option><option value="Verified">Verified</option></select></label>
                  <label>KYC level<input type="number" min={0} max={3} value={kycValue} onChange={(event) => setKycValue(event.target.value)} style={{ width: 90 }} /></label>
                  <button type="button" className="button button-secondary" disabled={manageBusy} onClick={() => void runManage(
                    () => Promise.all([
                      updateAdminUserStatus(selectedUser.id, statusValue, reason || undefined),
                      updateAdminUserTier(selectedUser.id, tierValue, reason || undefined),
                      updateAdminUserKyc(selectedUser.id, Math.max(0, Math.min(3, Number(kycValue) || 0)), reason || undefined),
                    ]),
                    'Account profile updated.',
                  )}>Apply changes</button>
                </div>
                <div className="manage-row">
                  <label>Reason (optional, recorded in audit)<input value={reason} maxLength={200} onChange={(event) => setReason(event.target.value)} placeholder="e.g. verified documents in branch" style={{ minWidth: 260 }} /></label>
                </div>
              </div>
            ) : null}

            <div className="manage-section">
              <div className="detail-subheading">Recent devices</div>
              {selectedUser.devices.length ? <ul className="detail-list">{selectedUser.devices.map((device) => <li key={device.id}><strong>{device.name || device.platform}{device.isCurrent ? ' · Current' : ''}<br /><span className="muted-text">{device.platform} · last active {new Date(device.lastActiveAt).toLocaleString()}</span></strong>{canManageSessions ? <button type="button" className="action-button reject" disabled={manageBusy} onClick={() => void runManage(() => revokeAdminUserDevice(selectedUser.id, device.id), 'Device session revoked.')}>Revoke</button> : null}</li>)}</ul> : <p className="muted-text">No registered devices.</p>}
              {canManageSessions ? (
                <div className="manage-row">
                  <button type="button" className="button button-secondary" disabled={manageBusy} onClick={() => void runManage(() => revokeAdminUserSessions(selectedUser.id), 'All active sessions revoked.')}>Revoke all sessions</button>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
        {data ? <div className="pagination"><span>{data.total.toLocaleString()} matching accounts</span><div><button type="button" className="button button-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {Math.max(1, data.totalPages)}</span><button type="button" className="button button-secondary" disabled={loading || page >= data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div> : null}
      </section>
      <p className="privacy-note">Search and account changes are recorded for operational accountability. Customer credentials, national IDs, wallet balances, and device tokens are not shown.</p>
    </>
  );
}
