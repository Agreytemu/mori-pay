import { useCallback, useEffect, useState } from 'react';

import { AdminApiError, listAdminReconciliation, runAdminReconciliation } from '../api';
import type { AdminReconciliationPage } from '../types';

type State = 'stale' | 'unsettled' | 'all';

const STATE_LABELS: Record<State, string> = {
  stale: 'Stale',
  unsettled: 'Unsettled',
  all: 'All provider',
};

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function ReconciliationPage({ canRun }: { canRun: boolean }) {
  const [state, setState] = useState<State>('stale');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminReconciliationPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await listAdminReconciliation(page, 20, state));
    } catch (failure) {
      setError(failure instanceof AdminApiError && failure.status === 403
        ? 'Your account is not authorized to view reconciliation.'
        : 'Mori Pay could not load reconciliation records. Try again.');
    } finally {
      setLoading(false);
    }
  }, [page, state]);

  useEffect(() => { void load(); }, [load]);

  function changeState(next: State) {
    setPage(1);
    setNotice('');
    setState(next);
  }

  async function run() {
    if (busy) return;
    setBusy(true);
    setNotice('');
    try {
      const result = await runAdminReconciliation();
      setNoticeError(false);
      setNotice(`Reconciliation sweep complete — ${result.checked} provider transaction${result.checked === 1 ? '' : 's'} checked.`);
      await load();
    } catch (failure) {
      setNoticeError(true);
      setNotice(failure instanceof AdminApiError && failure.status === 403
        ? 'Your account is not authorized to run reconciliation.'
        : 'Mori Pay could not start the reconciliation sweep. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">PAYMENTS</p><h1>Reconciliation</h1><p>Provider transactions waiting on a final status. Stale records exceed the configured settlement window.</p></div>
        {canRun ? <button type="button" className="button button-primary refresh-button" disabled={busy} onClick={() => void run()}>{busy ? 'Running…' : 'Run reconciliation'}</button> : null}
      </section>

      <section className="data-panel">
        <div className="panel-heading">
          <div><h2>Provider queue</h2><p>{data ? `Stale after ${Math.round(data.staleSeconds / 60)} minutes without an outcome.` : 'Loading settlement window…'}</p></div>
          <div className="tab-switch" role="tablist">
            {(Object.keys(STATE_LABELS) as State[]).map((option) => (
              <button key={option} type="button" role="tab" aria-selected={option === state} className={option === state ? 'selected' : ''} onClick={() => changeState(option)}>{STATE_LABELS[option]}</button>
            ))}
          </div>
        </div>

        {notice ? <p className={`inline-note ${noticeError ? 'error' : 'success'}`} role="status" style={{ padding: '0 22px 12px' }}>{notice}</p> : null}
        {loading ? <div className="page-loading" role="status">Loading reconciliation records…</div> : null}
        {!loading && error ? <div className="page-error" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => void load()}>Retry</button></div> : null}
        {!loading && !error && data?.items.length === 0 ? <div className="table-empty">Nothing in the reconciliation queue for this view.</div> : null}
        {!loading && !error && data?.items.length ? (
          <div className="table-scroll"><table><thead><tr><th>REFERENCE</th><th>TYPE</th><th>STATUS</th><th>PROVIDER</th><th>AMOUNT</th><th>AGE</th><th>CREATED</th></tr></thead><tbody>
            {data.items.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.reference}</strong><small>{row.channel}</small></td>
                <td>{row.type}</td>
                <td><span className={`record-status status-${row.status}`}>{row.status}</span></td>
                <td>{row.provider ?? '—'}<small>{row.providerStatus ?? 'no provider status'}</small></td>
                <td>{row.currency} {Number(row.amount).toLocaleString()}</td>
                <td>{formatAge(row.ageSeconds)}</td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody></table></div>
        ) : null}
        <div className="pagination"><span>{data?.total.toLocaleString() ?? 0} records</span><div><button type="button" className="button button-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {Math.max(1, data?.totalPages ?? 1)}</span><button type="button" className="button button-secondary" disabled={loading || page >= (data?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
      </section>
    </>
  );
}
