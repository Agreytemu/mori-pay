import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { AdminApiError, listAdminSessions } from '../api';
import type { AdminSessionSearchPage } from '../types';

type State = 'all' | 'active' | 'revoked';

const STATE_LABELS: Record<State, string> = {
  all: 'All',
  active: 'Active',
  revoked: 'Revoked',
};

export function SessionsPage() {
  const [state, setState] = useState<State>('active');
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<AdminSessionSearchPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await listAdminSessions(page, 20, {
        ...(query ? { q: query } : {}),
        ...(state === 'all' ? {} : { state }),
      }));
    } catch (failure) {
      setError(failure instanceof AdminApiError && failure.status === 403
        ? 'Your account is not authorized to view sessions and devices.'
        : 'Mori Pay could not load sessions and devices. Try again.');
    } finally {
      setLoading(false);
    }
  }, [page, query, state]);

  useEffect(() => { void load(); }, [load]);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setQuery(queryInput.trim());
  }

  function changeState(next: State) {
    setPage(1);
    setState(next);
  }

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">SECURITY &amp; ACCESS</p><h1>Sessions &amp; devices</h1><p>Active and revoked customer sessions, with the device each was established from.</p></div>
        <button type="button" className="button button-secondary refresh-button" disabled={loading} onClick={() => void load()}>Refresh</button>
      </section>

      <section className="data-panel">
        <form className="search-form" onSubmit={search}>
          <label htmlFor="session-search">Search by customer name, member ID, phone, or account ID</label>
          <div className="search-controls">
            <input id="session-search" autoComplete="off" maxLength={80} value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Enter a customer to filter sessions" />
            <button className="button button-primary" type="submit" disabled={loading}>Search</button>
          </div>
        </form>

        <div className="panel-heading" style={{ borderBottom: '1px solid var(--border)' }}>
          <div><h2>Sessions</h2><p>Session tokens are never displayed.</p></div>
          <div className="tab-switch" role="tablist">
            {(Object.keys(STATE_LABELS) as State[]).map((option) => (
              <button key={option} type="button" role="tab" aria-selected={option === state} className={option === state ? 'selected' : ''} onClick={() => changeState(option)}>{STATE_LABELS[option]}</button>
            ))}
          </div>
        </div>

        {loading ? <div className="page-loading" role="status">Loading sessions…</div> : null}
        {!loading && error ? <div className="page-error" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => void load()}>Retry</button></div> : null}
        {!loading && !error && data?.items.length === 0 ? <div className="table-empty">No sessions match this view.</div> : null}
        {!loading && !error && data?.items.length ? (
          <div className="table-scroll"><table><thead><tr><th>CUSTOMER</th><th>DEVICE</th><th>STATUS</th><th>CREATED</th><th>EXPIRES</th><th>LAST ACTIVE</th></tr></thead><tbody>
            {data.items.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.user.name}</strong><small>{row.user.memberId}</small></td>
                <td>{row.device ? <>{row.device.name}<small>{row.device.platform}</small></> : '—'}</td>
                <td><span className={`record-status ${row.isActive ? 'status-active' : 'status-revoked'}`}>{row.isActive ? 'active' : 'revoked'}</span></td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{new Date(row.expiresAt).toLocaleString()}</td>
                <td>{row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody></table></div>
        ) : null}
        <div className="pagination"><span>{data?.total.toLocaleString() ?? 0} sessions</span><div><button type="button" className="button button-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {Math.max(1, data?.totalPages ?? 1)}</span><button type="button" className="button button-secondary" disabled={loading || page >= (data?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
      </section>
    </>
  );
}
