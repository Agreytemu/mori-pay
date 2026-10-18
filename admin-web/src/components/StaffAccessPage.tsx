import { useState } from 'react';
import type { FormEvent } from 'react';

import {
  AdminApiError,
  searchAdminStaff,
  updateAdminStaffRole,
} from '../api';
import type { AdminStaffRole, AdminStaffSearchPage } from '../types';
import { Alert } from './Alert';

const roles: Array<{ value: AdminStaffRole | ''; label: string }> = [
  { value: '', label: 'No admin access' },
  { value: 'super_admin', label: 'Super admin' },
  { value: 'merchant_operations', label: 'Merchant operations' },
  { value: 'customer_support', label: 'Customer support' },
  { value: 'finance_reconciliation', label: 'Finance & reconciliation' },
];

function requestError(error: unknown): string {
  if (error instanceof AdminApiError && error.status === 403) {
    return 'Only an active super admin can manage staff access.';
  }
  if (error instanceof AdminApiError && error.status === 404) {
    return 'That account is no longer active. Refresh the search results.';
  }
  if (error instanceof AdminApiError && error.status === 0) {
    return 'You are not connected to internet.';
  }
  return 'Mori Pay could not update staff access. Try again shortly.';
}

export function StaffAccessPage({ currentUserId }: { currentUserId: string }) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<AdminStaffSearchPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function search(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setError('Enter at least three characters to search active users.');
      setResult(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setResult(await searchAdminStaff(trimmed));
    } catch (failure) {
      setError(requestError(failure));
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(user: AdminStaffSearchPage['items'][number], role: AdminStaffRole | null) {
    if (busyId || user.id === currentUserId || role === user.staffRole) return;
    const requestedRole = role
      ? roles.find((item) => item.value === role)?.label ?? 'selected role'
      : 'remove admin access';
    if (!window.confirm(`Set ${user.name} to ${requestedRole}? Their active sessions will be signed out.`)) return;
    setBusyId(user.id);
    setError('');
    setNotice('');
    try {
      await updateAdminStaffRole(user.id, role);
      setNotice(`Staff access updated for ${user.name}.`);
      await search();
    } catch (failure) {
      setError(requestError(failure));
    } finally {
      setBusyId('');
    }
  }

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">SECURITY & ACCESS</p><h1>Staff access</h1><p>Assign least-privilege roles to active users with a verified email. Role changes revoke existing sessions.</p></div>
      </section>
      {error ? <Alert tone="error" onDismiss={() => setError('')}>{error}</Alert> : null}
      {notice ? <Alert tone="success" onDismiss={() => setNotice('')}>{notice}</Alert> : null}
      <section className="data-panel">
        <div className="panel-heading">
          <div><h2>Find a user</h2><p>Search matches are privacy-masked. Use a name, phone, email, member ID, or user ID.</p></div>
        </div>
        <form className="search-form" onSubmit={(event) => void search(event)}>
          <label htmlFor="staff-search">Search active users</label>
          <div className="search-controls">
            <input id="staff-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, phone, email, member ID, or user ID" minLength={3} maxLength={80} />
            <button className="button button-primary" type="submit" disabled={loading}>{loading ? 'Searching…' : 'Search'}</button>
          </div>
        </form>
        {loading ? <div className="page-loading" role="status">Searching active users…</div> : null}
        {!loading && result ? (
          result.items.length ? (
            <div className="table-scroll">
              <table>
                <thead><tr><th>User</th><th>Phone</th><th>Member ID</th><th>Current role</th><th>Access</th></tr></thead>
                <tbody>{result.items.map((user) => (
                  <tr key={user.id}>
                    <td><strong>{user.name}</strong><small>{user.email ?? 'No email on file'}</small></td>
                    <td>{user.phone ?? '—'}</td>
                    <td>{user.memberId}</td>
                    <td>{user.staffRole ? roles.find((item) => item.value === user.staffRole)?.label : 'No admin access'}</td>
                    <td>
                      <label className="sr-only" htmlFor={`staff-role-${user.id}`}>Role for {user.name}</label>
                      <select
                        id={`staff-role-${user.id}`}
                        value={user.staffRole ?? ''}
                        disabled={busyId === user.id || user.id === currentUserId}
                        title={user.id === currentUserId ? 'You cannot change your own role' : undefined}
                        onChange={(event) => {
                          const selectedRole = roles.find((role) => role.value === event.target.value)?.value ?? '';
                          void changeRole(user, selectedRole || null);
                        }}
                      >
                        {roles.map((role) => <option key={role.value || 'none'} value={role.value}>{role.label}</option>)}
                      </select>
                      {user.id === currentUserId ? <small>Self-change disabled</small> : null}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="table-empty">No active users matched that search.</div>
        ) : null}
      </section>
    </>
  );
}
