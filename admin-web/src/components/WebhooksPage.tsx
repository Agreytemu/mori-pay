import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { AdminApiError, listAdminWebhooks } from '../api';
import type { AdminWebhookEventPage } from '../types';

type State = 'all' | 'pending' | 'processed' | 'failed';

const STATE_LABELS: Record<State, string> = {
  all: 'All',
  pending: 'Pending',
  processed: 'Processed',
  failed: 'Failed',
};

export function WebhooksPage() {
  const [state, setState] = useState<State>('all');
  const [page, setPage] = useState(1);
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [data, setData] = useState<AdminWebhookEventPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await listAdminWebhooks(page, 20, {
        ...(query ? { q: query } : {}),
        ...(state === 'all' ? {} : { state }),
      }));
    } catch (failure) {
      setError(failure instanceof AdminApiError && failure.status === 403
        ? 'Your account is not authorized to view webhook events.'
        : 'Mori Pay could not load webhook events. Try again.');
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
        <div><p className="eyebrow">PAYMENTS</p><h1>Webhook events</h1><p>Every delivery received from the payment provider, with its processing outcome and any recorded error.</p></div>
        <button type="button" className="button button-secondary refresh-button" disabled={loading} onClick={() => void load()}>Refresh</button>
      </section>

      <section className="data-panel">
        <form className="search-form" onSubmit={search}>
          <label htmlFor="webhook-search">Search by event, event ID, or transaction reference</label>
          <div className="search-controls">
            <input id="webhook-search" autoComplete="off" maxLength={120} value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="e.g. payment.completed or TX-…" />
            <button className="button button-primary" type="submit" disabled={loading}>Search</button>
          </div>
        </form>

        <div className="panel-heading" style={{ borderBottom: '1px solid var(--border)' }}>
          <div><h2>Deliveries</h2><p>Provider callbacks retained for audit.</p></div>
          <div className="tab-switch" role="tablist">
            {(Object.keys(STATE_LABELS) as State[]).map((option) => (
              <button key={option} type="button" role="tab" aria-selected={option === state} className={option === state ? 'selected' : ''} onClick={() => changeState(option)}>{STATE_LABELS[option]}</button>
            ))}
          </div>
        </div>

        {loading ? <div className="page-loading" role="status">Loading webhook events…</div> : null}
        {!loading && error ? <div className="page-error" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => void load()}>Retry</button></div> : null}
        {!loading && !error && data?.items.length === 0 ? <div className="table-empty">No webhook events match this view.</div> : null}
        {!loading && !error && data?.items.length ? (
          <div className="table-scroll"><table><thead><tr><th>EVENT</th><th>REFERENCE</th><th>STATUS</th><th>ERROR</th><th>RECEIVED</th><th>PROCESSED</th></tr></thead><tbody>
            {data.items.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.event}</strong><small>{row.eventId}</small></td>
                <td>{row.transactionReference}</td>
                <td><span className={`record-status ${row.processed ? 'status-completed' : row.errorPresent ? 'status-failed' : 'status-pending'}`}>{row.processed ? 'processed' : row.errorPresent ? 'failed' : 'pending'}</span></td>
                <td>{row.error ? <small title={row.error}>{row.error}</small> : '—'}</td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.processedAt ? new Date(row.processedAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody></table></div>
        ) : null}
        <div className="pagination"><span>{data?.total.toLocaleString() ?? 0} events</span><div><button type="button" className="button button-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {Math.max(1, data?.totalPages ?? 1)}</span><button type="button" className="button button-secondary" disabled={loading || page >= (data?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
      </section>
    </>
  );
}
