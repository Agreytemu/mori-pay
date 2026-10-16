import type { MerchantPortal } from '../types';
import { Metric } from '../components/Metric';
import { formatMoney } from '../utils/format';

export function ReportsPage({
  portal,
  busy,
  onExport,
}: {
  portal: MerchantPortal | null;
  busy: boolean;
  onExport: () => void;
}) {
  const report = portal?.report;
  const currency = portal?.merchant?.currency;
  return (
    <div className="stack">
      <div className="metric-grid">
        <Metric label="Gross received" value={report ? formatMoney(report.grossReceived, currency) : '—'} note="Successful credits on the merchant ledger." icon="↗" accent />
        <Metric label="Successful" value={report ? String(report.completedCount) : '—'} note="Confirmed merchant payments." icon="✓" />
        <Metric label="Pending or processing" value={report ? report.pendingCount == null ? 'Not tracked' : String(report.pendingCount) : '—'} note="The backend does not store merchant-linked pending attempts." icon="◷" />
        <Metric label="Failed or cancelled" value={report ? report.failedCount == null || report.cancelledCount == null ? 'Not tracked' : `${report.failedCount} / ${report.cancelledCount}` : '—'} note="Failed attempts are not linked to merchant ledger records." icon="!" />
      </div>
      <section className="panel report-panel">
        <span className="eyebrow">CLEAR FINANCIAL REPORTING</span>
        <h2>Fees, balances and settlement</h2>
        <p className="report-intro">
          Reports show only figures that Mori Pay can verify from the current
          merchant ledger. Values that are not recorded by the backend are
          identified as unavailable.
        </p>
        <div className="report-note">
          <strong>Customer transaction fees</strong>
          <span>{report ? formatMoney(report.customerFees, currency) : '—'}</span>
          <p>This is the payer-side fee. It is not a merchant fee.</p>
        </div>
        <div className="report-note">
          <strong>Merchant fees</strong><span>Not configured</span>
          <p>A merchant fee policy has not been configured in the backend.</p>
        </div>
        <div className="report-note">
          <strong>Settlement and payout</strong><span>Not available</span>
          <p>Settlement and payout records are not available in the current backend.</p>
        </div>
        <div className="report-note">
          <strong>Reversals and refunds</strong><span>Not available</span>
          <p>The current merchant transaction model does not record reversal or refund states.</p>
        </div>
        <button className="button button-primary" disabled={busy} onClick={onExport}>
          {busy ? 'Preparing export…' : '↓  Export matching transactions (CSV)'}
        </button>
      </section>
    </div>
  );
}
