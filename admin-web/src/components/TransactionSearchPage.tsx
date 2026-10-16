import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { AdminApiError, getAdminTransaction, searchAdminTransactions } from '../api';
import { useAutoRefresh } from '../use-auto-refresh';
import type { AdminTransactionDetail, AdminTransactionSearchPage } from '../types';

const REFRESH_INTERVAL_MS = 15_000;

function money(amount: string, currency: string): string {
  return `${currency} ${BigInt(amount).toLocaleString()}`;
}

export function TransactionSearchPage() {
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminTransactionSearchPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const [searchVersion, setSearchVersion] = useState(0);
  const [selectedTransaction, setSelectedTransaction] = useState<AdminTransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    if (!silent) setError('');
    try {
      const result = await searchAdminTransactions(term, page);
      setData(result);
      setLastUpdated(new Date());
      setError('');
    } catch (failure) {
      if (!silent) {
        setError(failure instanceof AdminApiError && failure.status === 403
          ? 'Your account is not authorized to view transaction records.'
          : 'Mori Pay could not load transactions. Try again.');
      }
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, [page, term]);

  useEffect(() => { void load(); }, [load, searchVersion]);

  useAutoRefresh(() => { void load(true); }, REFRESH_INTERVAL_MS);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = input.trim();
    if (normalized && (normalized.length < 3 || normalized.length > 80)) {
      setValidation('Enter at least 3 characters and no more than 80, or leave blank to browse all transactions.');
      return;
    }
    setValidation('');
    setData(null);
    setSelectedTransaction(null);
    setPage(1);
    if (normalized === term) {
      setSearchVersion((version) => version + 1);
    } else {
      setTerm(normalized);
    }
  }

  async function openDetails(transactionId: string) {
    setDetailLoading(true);
    setDetailError('');
    try {
      setSelectedTransaction(await getAdminTransaction(transactionId));
    } catch {
      setDetailError('Mori Pay could not load this transaction record. Try again.');
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">FINANCE OPERATIONS</p><h1>Transactions</h1><p>Every transaction is listed live. Filter by reference, internal/provider reference, customer name, phone, or member ID. This view cannot change payment outcomes.</p></div>
        <div className="live-indicator" role="status">
          <span className="live-dot" aria-hidden="true" />
          <div><strong>Live</strong><small>{refreshing ? 'Refreshing…' : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading…'}</small></div>
        </div>
      </section>
      <section className="data-panel">
        <form className="search-form" onSubmit={submit}>
          <label htmlFor="transaction-search">Filter transactions (optional)</label>
          <div className="search-controls">
            <input id="transaction-search" autoComplete="off" maxLength={80} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Reference, customer name/phone/member ID — or leave blank for all" />
            <button className="button button-primary" type="submit" disabled={loading}>Search</button>
          </div>
          {validation ? <small className="search-validation" role="alert">{validation}</small> : null}
        </form>
        {loading ? <div className="page-loading" role="status">Loading transaction records…</div> : null}
        {!loading && error ? <div className="page-error" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => void load()}>Retry</button></div> : null}
        {!loading && !error && term && data?.items.length === 0 ? <div className="table-empty">No matching transactions.</div> : null}
        {!loading && !error && !term && data?.items.length === 0 ? <div className="table-empty">No transactions have been recorded yet.</div> : null}
        {!loading && !error && data?.items.length ? (
          <div className="table-scroll"><table><thead><tr><th>TRANSACTION</th><th>CUSTOMER</th><th>TYPE / CHANNEL</th><th>STATUS</th><th>AMOUNT / FEE</th><th>CREATED</th><th></th></tr></thead><tbody>
            {data.items.map((transaction) => <tr key={transaction.id}><td><strong>{transaction.reference}</strong><small>{transaction.category} · {transaction.direction}</small></td><td><strong>{transaction.user.name}</strong><small>{transaction.user.phone ?? 'No phone'} · {transaction.user.memberId}</small></td><td>{transaction.type}<small>{transaction.channel}{transaction.provider ? ` · ${transaction.provider}` : ''}</small></td><td><span className={`record-status status-${transaction.status}`}>{transaction.status}</span>{transaction.providerStatus ? <small>Provider: {transaction.providerStatus}</small> : null}</td><td><strong>{money(transaction.amount, transaction.currency)}</strong><small>Fee {money(transaction.fee, transaction.currency)}</small></td><td>{new Date(transaction.createdAt).toLocaleString()}{transaction.settledAt ? <small>Settled {new Date(transaction.settledAt).toLocaleString()}</small> : null}</td><td><button type="button" className="action-button" disabled={detailLoading} onClick={() => void openDetails(transaction.id)}>Details</button></td></tr>)}
          </tbody></table></div>
        ) : null}
        {detailLoading ? <div className="page-loading" role="status">Loading audited transaction detail and reconciliation history…</div> : null}
        {detailError ? <div className="page-error" role="alert">{detailError}</div> : null}
        {selectedTransaction ? (
          <section className="detail-panel" aria-label="Transaction details">
            <div className="detail-heading"><div><p className="eyebrow">READ-ONLY INVESTIGATION</p><h2>{selectedTransaction.reference}</h2></div><button className="button button-secondary" type="button" onClick={() => setSelectedTransaction(null)}>Close</button></div>
            <div className="detail-grid">
              <div><small>STATUS</small><strong>{selectedTransaction.status} · Provider {selectedTransaction.providerStatus ?? 'not reported'}</strong></div>
              <div><small>AMOUNT / FEE / TOTAL</small><strong>{money(selectedTransaction.amount, selectedTransaction.currency)} / {money(selectedTransaction.fee, selectedTransaction.currency)} / {money(selectedTransaction.total, selectedTransaction.currency)}</strong></div>
              <div><small>CUSTOMER</small><strong>{selectedTransaction.user.name} · {selectedTransaction.user.phone ?? 'No phone'} · {selectedTransaction.user.memberId}</strong></div>
              <div><small>TIMESTAMPS</small><strong>Created {new Date(selectedTransaction.createdAt).toLocaleString()} · Updated {new Date(selectedTransaction.updatedAt).toLocaleString()}{selectedTransaction.settledAt ? ` · Settled ${new Date(selectedTransaction.settledAt).toLocaleString()}` : ''}</strong></div>
            </div>
            <div className="detail-subheading">Ledger entries · read-only</div>
            {selectedTransaction.ledgerEntries.length ? <ul className="detail-list">{selectedTransaction.ledgerEntries.map((entry, index) => <li key={`${entry.createdAt}-${index}`}><strong>{entry.accountKind} · {entry.direction} · {money(entry.amount, selectedTransaction.currency)}</strong><span>{new Date(entry.createdAt).toLocaleString()}</span></li>)}</ul> : <p className="muted-text">No ledger entries are linked to this transaction.</p>}
            <div className="detail-subheading">Reconciliation events</div>
            {selectedTransaction.reconciliationEvents.length ? <ul className="detail-list">{selectedTransaction.reconciliationEvents.map((event, index) => <li key={`${event.createdAt}-${index}`}><strong>{event.event}</strong><span>{new Date(event.createdAt).toLocaleString()} · {event.processed ? 'Processed' : 'Unprocessed'}{event.errorPresent ? ' · Error recorded (details hidden)' : ''}</span></li>)}</ul> : <p className="muted-text">No matching webhook reconciliation events.</p>}
          </section>
        ) : null}
        {data ? <div className="pagination"><span>{data.total.toLocaleString()} {term ? 'matching' : 'total'} transactions</span><div><button type="button" className="button button-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {Math.max(1, data.totalPages)}</span><button type="button" className="button button-secondary" disabled={loading || page >= data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></div></div> : null}
      </section>
      <p className="privacy-note">List refreshes every {REFRESH_INTERVAL_MS / 1000} seconds. Search access is audited. Provider references, raw gateway payloads, counterparty details, and write controls are intentionally excluded.</p>
    </>
  );
}
