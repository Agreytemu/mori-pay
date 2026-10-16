import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { AdminApiError, getAdminReport } from '../api';
import type { AdminReport } from '../types';

function formatMoney(value: string): string {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toLocaleString() : value;
}

export function ReportsPage() {
  const [data, setData] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [range, setRange] = useState<{ from?: string; to?: string }>({});
  const [validation, setValidation] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getAdminReport(range.from, range.to));
    } catch (failure) {
      setError(failure instanceof AdminApiError && failure.status === 403
        ? 'Your account is not authorized to view reports.'
        : 'Mori Pay could not build this report. Try again.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  function applyRange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fromInput && toInput && fromInput > toInput) {
      setValidation('The start date must be before the end date.');
      return;
    }
    setValidation('');
    setRange({
      ...(fromInput ? { from: new Date(`${fromInput}T00:00:00`).toISOString() } : {}),
      ...(toInput ? { to: new Date(`${toInput}T23:59:59.999`).toISOString() } : {}),
    });
  }

  function clearRange() {
    setFromInput('');
    setToInput('');
    setRange({});
    setValidation('');
  }

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">INSIGHT</p><h1>Reports &amp; analytics</h1><p>Aggregate activity across customers, transactions, and merchant onboarding for a chosen period.</p></div>
        <button type="button" className="button button-secondary refresh-button" disabled={loading} onClick={() => void load()}>Refresh</button>
      </section>

      <section className="data-panel" style={{ marginBottom: 18 }}>
        <form className="audit-filters" style={{ borderTop: 0 }} onSubmit={applyRange}>
          <label>From<input type="date" value={fromInput} onChange={(event) => setFromInput(event.target.value)} /></label>
          <label>To<input type="date" value={toInput} onChange={(event) => setToInput(event.target.value)} /></label>
          <button className="button button-primary" type="submit" disabled={loading}>Apply period</button>
          <button className="button button-secondary" type="button" onClick={clearRange}>Clear</button>
          {validation ? <small className="search-validation" role="alert">{validation}</small> : null}
        </form>
      </section>

      {loading ? <div className="page-loading" role="status">Building report…</div> : null}
      {!loading && error ? <div className="page-error" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => void load()}>Retry</button></div> : null}

      {!loading && !error && data ? (
        <>
          <div className="overview-grid">
            <article className="overview-card">
              <div className="card-icon blue">♙</div>
              <span className="card-label">CUSTOMERS CREATED</span>
              <strong>{data.users.created.toLocaleString()}</strong>
              <small>{data.users.active.toLocaleString()} active · {data.users.restricted.toLocaleString()} restricted</small>
            </article>
            <article className="overview-card">
              <div className="card-icon teal">↗</div>
              <span className="card-label">TRANSACTIONS</span>
              <strong>{data.transactions.total.toLocaleString()}</strong>
              <small>{data.transactions.completed.toLocaleString()} completed · {data.transactions.failed.toLocaleString()} failed · {data.transactions.pending.toLocaleString()} pending</small>
            </article>
            <article className="overview-card">
              <div className="card-icon violet">≡</div>
              <span className="card-label">VOLUME</span>
              <strong>{data.transactions.currency} {formatMoney(data.transactions.volume)}</strong>
              <small>Fees {data.transactions.currency} {formatMoney(data.transactions.fees)}</small>
            </article>
          </div>

          <div className="settings-grid">
            <section className="data-panel">
              <div className="panel-heading"><div><h2>By channel</h2><p>Transaction count and volume per channel.</p></div></div>
              {data.transactions.byChannel.length ? (
                <div className="table-scroll"><table><thead><tr><th>CHANNEL</th><th>COUNT</th><th>VOLUME</th></tr></thead><tbody>
                  {data.transactions.byChannel.map((row) => (
                    <tr key={row.channel}><td><strong>{row.channel.replaceAll('_', ' ')}</strong></td><td>{row.count.toLocaleString()}</td><td>{data.transactions.currency} {formatMoney(row.volume)}</td></tr>
                  ))}
                </tbody></table></div>
              ) : <div className="table-empty">No channel activity in this period.</div>}
            </section>

            <section className="data-panel">
              <div className="panel-heading"><div><h2>By status</h2><p>Outcome distribution for the period.</p></div></div>
              {data.transactions.byStatus.length ? (
                <div className="table-scroll"><table><thead><tr><th>STATUS</th><th>COUNT</th></tr></thead><tbody>
                  {data.transactions.byStatus.map((row) => (
                    <tr key={row.status}><td><span className={`record-status status-${row.status}`}>{row.status}</span></td><td>{row.count.toLocaleString()}</td></tr>
                  ))}
                </tbody></table></div>
              ) : <div className="table-empty">No transactions in this period.</div>}
            </section>
          </div>

          <div className="settings-grid">
            <section className="settings-card compact">
              <div><small>Merchant applications</small><strong>{data.merchants.applications.toLocaleString()}</strong></div>
              <div><small>Approved applications</small><strong>{data.merchants.approved.toLocaleString()}</strong></div>
              <div><small>Active merchant accounts</small><strong>{data.merchants.activeAccounts.toLocaleString()}</strong></div>
            </section>
            <section className="settings-card compact">
              <div><small>Period start</small><strong>{data.from ? new Date(data.from).toLocaleString() : 'All time'}</strong></div>
              <div><small>Period end</small><strong>{data.to ? new Date(data.to).toLocaleString() : 'Now'}</strong></div>
              <div><small>Generated</small><strong>{new Date(data.generatedAt).toLocaleString()}</strong></div>
            </section>
          </div>
        </>
      ) : null}
    </>
  );
}
