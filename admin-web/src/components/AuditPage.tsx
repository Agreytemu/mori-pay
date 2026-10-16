import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { AdminApiError, listAudit } from '../api';
import type { AdminAuditPage } from '../types';

export function AuditPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminAuditPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionInput, setActionInput] = useState('');
  const [action, setAction] = useState('');
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});
  const [validation, setValidation] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await listAudit(page, 20, {
        ...(action ? { action } : {}),
        ...dateRange,
      }));
    } catch (failure) {
      setError(failure instanceof AdminApiError && failure.status === 403
        ? 'Your account is not authorized to view the audit history.'
        : 'Mori Pay could not load the audit history. Refresh to try again.');
    } finally {
      setLoading(false);
    }
  }, [action, dateRange, page]);

  useEffect(() => { void load(); }, [load]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedAction = actionInput.trim();
    if (normalizedAction && normalizedAction.length < 3) {
      setValidation('Enter at least 3 characters for an action filter.');
      return;
    }
    if (fromInput && toInput && fromInput > toInput) {
      setValidation('The start date must be before the end date.');
      return;
    }
    setValidation('');
    setPage(1);
    setAction(normalizedAction);
    setDateRange({
      ...(fromInput ? { from: new Date(`${fromInput}T00:00:00`).toISOString() } : {}),
      ...(toInput ? { to: new Date(`${toInput}T23:59:59.999`).toISOString() } : {}),
    });
  }

  function clearFilters() {
    setActionInput('');
    setFromInput('');
    setToInput('');
    setAction('');
    setDateRange({});
    setValidation('');
    setPage(1);
  }

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">GOVERNANCE</p><h1>Audit history</h1><p>Administrative actions recorded by Mori Pay. Sensitive payloads are not exposed here.</p></div>
        <button type="button" className="button button-secondary refresh-button" disabled={loading} onClick={() => void load()}>Refresh</button>
      </section>
      <section className="data-panel">
        <div className="panel-heading"><div><h2>Recent actions</h2><p>Actor, operation, and timestamp only.</p></div></div>
        <form className="audit-filters" onSubmit={applyFilters}>
          <label>Action contains<input value={actionInput} maxLength={100} onChange={(event) => setActionInput(event.target.value)} placeholder="e.g. admin.user.view" /></label>
          <label>From<input type="date" value={fromInput} onChange={(event) => setFromInput(event.target.value)} /></label>
          <label>To<input type="date" value={toInput} onChange={(event) => setToInput(event.target.value)} /></label>
          <button className="button button-primary" type="submit" disabled={loading}>Apply filters</button>
          <button className="button button-secondary" type="button" onClick={clearFilters}>Clear</button>
          {validation ? <small className="search-validation" role="alert">{validation}</small> : null}
        </form>
        {loading ? <div className="page-loading" role="status">Loading audit history…</div> : null}
        {!loading && error ? <div className="page-error" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => void load()}>Retry</button></div> : null}
        {!loading && !error && data?.items.length === 0 ? <div className="table-empty">No audit events are available.</div> : null}
        {!loading && !error && data?.items.length ? <div className="table-scroll"><table><thead><tr><th>ACTOR</th><th>ACTION</th><th>RECORDED AT</th></tr></thead><tbody>{data.items.map((entry) => <tr key={entry.id}><td>{entry.actor?.name ?? 'System'}<small>{entry.actor?.id ?? 'system process'}</small></td><td><span className="audit-action">{entry.action.replaceAll('.', ' · ')}</span></td><td>{new Date(entry.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : null}
        <div className="pagination"><span>{data?.total.toLocaleString() ?? 0} records</span><div><button type="button" className="button button-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {Math.max(1, data?.totalPages ?? 1)}</span><button type="button" className="button button-secondary" disabled={loading || page >= (data?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
      </section>
    </>
  );
}
