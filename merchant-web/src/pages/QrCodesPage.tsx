import type { FormEvent } from 'react';
import type { MerchantPortalQrCode, MerchantQrCode } from '../types';
import { Empty, StatusBadge } from '../components/Feedback';
import { formatDate, formatMoney, qrStatus } from '../utils/format';

export type QrExpiry = 'none' | 'day' | 'week' | 'month';

export function QrCodesPage({
  codes,
  kind,
  amount,
  reusable,
  expiry,
  created,
  image,
  busy,
  confirmId,
  onKind,
  onAmount,
  onReusable,
  onExpiry,
  onCreate,
  onConfirmId,
  onCancel,
  onDownload,
  onPrint,
  onDismissCreated,
}: {
  codes: MerchantPortalQrCode[];
  kind: 'static' | 'fixed';
  amount: string;
  reusable: boolean;
  expiry: QrExpiry;
  created: MerchantQrCode | null;
  image: string;
  busy: boolean;
  confirmId: string;
  onKind: (value: 'static' | 'fixed') => void;
  onAmount: (value: string) => void;
  onReusable: (value: boolean) => void;
  onExpiry: (value: QrExpiry) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onConfirmId: (value: string) => void;
  onCancel: (id: string) => void;
  onDownload: () => void;
  onPrint: () => void;
  onDismissCreated: () => void;
}) {
  return (
    <div className="stack">
      <div className="qr-grid">
        <form className="panel qr-form" onSubmit={onCreate}>
          <span className="eyebrow">PAYMENT COLLECTION</span>
          <h2>Create a payment QR code</h2>
          <p className="muted">
            Customers can scan a Mori Pay QR code to pay your business from
            their wallet.
          </p>
          <div className="segmented" aria-label="Choose QR type">
            <button type="button" className={kind === 'static' ? 'selected' : ''} aria-pressed={kind === 'static'} onClick={() => onKind('static')}>Any amount</button>
            <button type="button" className={kind === 'fixed' ? 'selected' : ''} aria-pressed={kind === 'fixed'} onClick={() => onKind('fixed')}>Fixed amount</button>
          </div>
          {kind === 'fixed' ? (
            <label className="field">
              <span>Payment amount (TZS)</span>
              <input type="number" min="1" step="1" required value={amount} onChange={(event) => onAmount(event.target.value)} placeholder="Enter a whole-number amount" />
            </label>
          ) : (
            <div className="field-hint">
              Customers enter the amount they want to pay when they scan this code.
            </div>
          )}
          {kind === 'fixed' ? (
            <label className="check-field">
              <input type="checkbox" checked={reusable} onChange={(event) => onReusable(event.target.checked)} />
              <span><b>Reusable QR code</b><small>Allow multiple payments with this fixed amount.</small></span>
            </label>
          ) : null}
          <label className="field">
            <span>Code expiry</span>
            <select value={expiry} onChange={(event) => onExpiry(event.target.value as QrExpiry)}>
              <option value="day">1 day</option><option value="week">7 days</option>
              <option value="month">30 days</option><option value="none">No expiry</option>
            </select>
          </label>
          <button className="button button-primary button-full" disabled={busy}>
            {busy ? 'Creating secure QR…' : '＋  Create QR code'}
          </button>
        </form>
        {created && image ? (
          <div className="panel created-qr">
            <button className="dismiss-button" onClick={onDismissCreated} aria-label="Close">×</button>
            <span className="eyebrow">NEW QR CODE</span>
            <h2>Your code is ready</h2>
            <p className="muted">
              Download or print this code now. For your security the QR secret
              is shown only at creation and cannot be recovered later.
            </p>
            <img src={image} alt="New Mori Pay merchant payment QR code" />
            <strong>{created.kind === 'static' ? 'Customer enters an amount' : formatMoney(created.amount ?? 0)}</strong>
            <div className="qr-actions">
              <button className="button button-light" onClick={onDownload}>↓ Download PNG</button>
              <button className="button button-light" onClick={onPrint}>Print QR</button>
            </div>
          </div>
        ) : (
          <div className="qr-info-card">
            <div className="qr-decoration" aria-hidden="true">▦</div>
            <span className="eyebrow">SIMPLE CUSTOMER PAYMENTS</span>
            <h2>One code.<br />Easy payments.</h2>
            <p>
              Display your merchant QR at the counter, on an invoice, or at your
              service desk. Customers scan it using their Mori Pay wallet.
            </p>
            <small>Keep the new QR image somewhere safe after creation.</small>
          </div>
        )}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">YOUR QR CODES</span>
            <h2>QR code history</h2>
            <p className="muted">Previously created codes show status only. Their QR secrets are not stored in recoverable form.</p>
          </div>
        </div>
        {codes.length ? (
          <div className="qr-history">
            {codes.map((qr) => (
              <div className="qr-history-row" key={qr.id}>
                <div className="qr-history-symbol" aria-hidden="true">▦</div>
                <div className="qr-history-main">
                  <strong>
                    {qr.kind === 'static' ? 'Static payment QR' : 'Fixed-amount QR'}
                    {qr.amount != null ? ` · ${formatMoney(qr.amount)}` : ''}
                  </strong>
                  <span>{qr.reusable ? 'Reusable' : 'One-time'} · {qr.uses} use{qr.uses === 1 ? '' : 's'} · Created {formatDate(qr.createdAt)}</span>
                  <span>{qr.expiresAt ? `Expires ${formatDate(qr.expiresAt)}` : 'No expiry'}</span>
                </div>
                <StatusBadge value={qrStatus(qr)} />
                {qrStatus(qr) === 'Active' ? (
                  confirmId === qr.id ? (
                    <div className="confirm-inline">
                      <span>Cancel this QR code?</span>
                      <button className="button button-light" onClick={() => onConfirmId('')}>Keep code</button>
                      <button className="button button-danger" disabled={busy} onClick={() => onCancel(qr.id)}>Confirm cancel</button>
                    </div>
                  ) : (
                    <button className="button button-light" onClick={() => onConfirmId(qr.id)}>Cancel QR</button>
                  )
                ) : null}
              </div>
            ))}
          </div>
        ) : <Empty text="No QR codes have been created yet. Create a static code or fixed-amount code above." />}
      </section>
    </div>
  );
}
