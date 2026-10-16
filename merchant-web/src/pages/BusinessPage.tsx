import type { MerchantPortal } from '../types';
import { formatDate, labelValue } from '../utils/format';

export function BusinessPage({ portal }: { portal: MerchantPortal | null }) {
  const merchant = portal?.merchant;
  if (!merchant) return null;
  const rows = [
    ['Business name', merchant.name],
    ['Merchant ID', merchant.identifier],
    ['Category', merchant.category],
    ['Contact phone', merchant.phone || 'Not provided'],
    ['Application status', labelValue(portal.application?.status ?? 'unknown')],
    ['Account status', labelValue(merchant.status)],
    ['Approved on', formatDate(merchant.approvedAt)],
  ];
  return (
    <section className="panel business-panel">
      <span className="eyebrow">ACCOUNT PROFILE</span>
      <h2>Business identity</h2>
      <p className="muted">
        Your verified business information is shown below. This portal does not
        allow unreviewed changes to merchant identity.
      </p>
      <div className="business-grid">
        {rows.map(([label, value]) => (
          <div className="business-row" key={label}>
            <span>{label}</span><strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="notice-strip">
        <span>i</span>
        <p>
          Business identity changes, notification preferences and payout
          settings are not currently supported. Contact Mori Pay support to
          request an approved change.
        </p>
      </div>
      {portal.application?.reviewNote ? (
        <div className="review-note">
          <span className="eyebrow">REVIEW NOTE</span>
          <p>{portal.application.reviewNote}</p>
        </div>
      ) : null}
    </section>
  );
}
