import type { MerchantPortal, MerchantPortalTransaction } from '../types';
import { Empty, TransactionRow } from '../components/Feedback';
import { Metric } from '../components/Metric';
import { formatMoney } from '../utils/format';

export function OverviewPage({
  portal,
  firstName,
  onTransactions,
  onTransaction,
}: {
  portal: MerchantPortal | null;
  firstName: string;
  onTransactions: () => void;
  onTransaction: (transaction: MerchantPortalTransaction) => void;
}) {
  const merchant = portal?.merchant;
  const report = portal?.report;
  return (
    <section className="stack">
      <header className="welcome-banner">
        <div>
          <span className="eyebrow">YOUR MERCHANT WORKSPACE</span>
          <h2>Welcome, {firstName}</h2>
          <p>{merchant?.name ?? 'Here is the latest activity on your Mori Pay merchant account.'}</p>
        </div>
        <span className="welcome-mark" aria-hidden="true">M</span>
      </header>
      <div className="metric-grid">
        <Metric
          label="Merchant ledger balance"
          value={merchant ? formatMoney(merchant.ledgerBalance, merchant.currency) : '—'}
          note="An internal ledger balance, not a bank settlement or guaranteed withdrawal."
          icon="◈"
        />
        <Metric
          label="Received in the selected period"
          value={report ? formatMoney(report.grossReceived, merchant?.currency) : '—'}
          note="Confirmed credits posted to your merchant ledger."
          icon="↗"
          accent
        />
        <Metric
          label="Completed payments"
          value={report ? String(report.completedCount) : '—'}
          note="Confirmed payments linked to merchant ledger entries."
          icon="✓"
        />
        <Metric
          label="Pending or failed attempts"
          value={report ? report.pendingCount == null ? 'Not tracked' : String(report.pendingCount) : '—'}
          note="The current backend does not track these merchant attempts."
          icon="◷"
        />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">LATEST ACTIVITY</span><h2>Recent payments</h2></div>
          <button className="text-button" onClick={onTransactions}>All transactions <span>→</span></button>
        </div>
        {portal?.recentTransactions.length ? (
          <div className="transaction-list">
            {portal.recentTransactions.map((item) => (
              <TransactionRow
                key={item.id}
                item={item}
                onClick={() => onTransaction(item)}
              />
            ))}
          </div>
        ) : <Empty text="No merchant payments have been recorded in this period." />}
      </section>
      <div className="notice-strip">
        <span>i</span>
        <p>
          Your balance reflects confirmed merchant ledger credits. It is not a
          bank settlement or guaranteed withdrawable balance.
        </p>
      </div>
    </section>
  );
}
