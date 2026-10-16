import { useEffect, useState } from 'react';

import { AdminApiError, getOverview } from '../api';
import type { AdminOverview } from '../types';

export function OverviewPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      setOverview(await getOverview());
    } catch (failure) {
      setError(
        failure instanceof AdminApiError && failure.status === 403
          ? 'Your access no longer permits viewing operations data.'
          : 'Mori Pay could not load the latest overview. Refresh to try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (loading) return <div className="page-loading" role="status">Loading system overview…</div>;
  if (error || !overview) {
    return <section className="page-error" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => void load()}>Retry</button></section>;
  }

  const cards = [
    { label: 'TOTAL USERS', value: overview.users.total, detail: `${overview.users.active.toLocaleString()} active · ${overview.users.restricted.toLocaleString()} restricted`, tone: 'blue', icon: '♙' },
    { label: 'MERCHANTS AWAITING REVIEW', value: overview.merchantApplications.awaitingReview, detail: `${overview.merchantApplications.pendingPayment.toLocaleString()} awaiting registration payment`, tone: 'teal', icon: '▤' },
    { label: 'ACTIVE MERCHANT ACCOUNTS', value: overview.merchantAccounts.active, detail: `${overview.merchantAccounts.suspended.toLocaleString()} suspended · ${overview.merchantAccounts.revoked.toLocaleString()} revoked`, tone: 'violet', icon: '◈' },
    { label: 'COMPLETED TRANSACTIONS', value: overview.transactions.completed, detail: `${overview.transactions.pending.toLocaleString()} pending · ${overview.transactions.processing.toLocaleString()} processing`, tone: 'blue', icon: '✓' },
    { label: 'FAILED / CANCELLED', value: overview.transactions.failed + overview.transactions.cancelled, detail: `${overview.transactions.failed.toLocaleString()} failed · ${overview.transactions.cancelled.toLocaleString()} cancelled`, tone: 'amber', icon: '!' },
    { label: 'UNPROCESSED WEBHOOK EVENTS', value: overview.webhookEvents.awaitingProcessing, detail: 'Includes queued and failed processing events', tone: 'teal', icon: '↻' },
    { label: 'WEBHOOK EVENTS WITH ERRORS', value: overview.webhookEvents.failedProcessing, detail: 'Requires backend/provider reconciliation review', tone: 'amber', icon: '!' },
  ];

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">MORI PAY OPERATIONS</p>
          <h1>Welcome back, Administrator</h1>
          <p>Current system counts from Mori Pay’s backend. Financial amounts are intentionally omitted.</p>
        </div>
        <span className="freshness-pill">Updated {new Date(overview.generatedAt).toLocaleString()}</span>
      </section>
      <section className="overview-grid live-overview" aria-label="System overview">
        {cards.map((card) => (
          <article className="overview-card" key={card.label}>
            <span className={`card-icon ${card.tone}`}>{card.icon}</span>
            <span className="card-label">{card.label}</span>
            <strong>{card.value.toLocaleString()}</strong>
            <small>{card.detail}</small>
          </article>
        ))}
      </section>
      <section className="overview-note">
        <span className="note-icon" aria-hidden="true">i</span>
        <div>
          <strong>Operational summary only</strong>
          <p>Counts are read from current records at request time. Transaction statuses do not authorize manual financial changes; provider outcomes remain controlled by backend reconciliation.</p>
        </div>
      </section>
      <section className="data-panel overview-channels">
        <div className="panel-heading"><div><h2>Transactions by channel</h2><p>All-time transaction counts as recorded in Mori Pay.</p></div></div>
        {overview.transactions.byChannel.length
          ? <div className="channel-summary">{overview.transactions.byChannel.map((item) => <div key={item.channel}><strong>{item.channel.replaceAll('_', ' ')}</strong><span>{item.count.toLocaleString()}</span></div>)}</div>
          : <div className="table-empty">No transaction channel records are available.</div>}
      </section>
    </>
  );
}
