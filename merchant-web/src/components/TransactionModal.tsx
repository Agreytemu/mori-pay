import type { MerchantPortalTransaction } from '../types';
import { formatDate, formatMoney, labelValue } from '../utils/format';
import { StatusBadge } from './Feedback';

export function TransactionModal({
  transaction,
  onClose,
  onPrint,
}: {
  transaction: MerchantPortalTransaction;
  onClose: () => void;
  onPrint: () => void;
}) {
  const details = [
    ['Transaction ID', transaction.id],
    ['Type', labelValue(transaction.type)],
    ['Method', labelValue(transaction.channel)],
    ['Customer transaction fee', formatMoney(transaction.fee, transaction.currency)],
    ['Customer total paid', formatMoney(transaction.total, transaction.currency)],
    ['Created', formatDate(transaction.createdAt)],
    ['Settled', formatDate(transaction.settledAt)],
  ];
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="transaction-title"
      >
        <button className="dismiss-button" onClick={onClose} aria-label="Close">×</button>
        <span className="eyebrow">TRANSACTION DETAILS</span>
        <h2 id="transaction-title">{transaction.reference}</h2>
        <StatusBadge value={transaction.status} />
        <div className="detail-amount">
          {formatMoney(transaction.merchantAmount, transaction.currency)}
          <small>Amount received</small>
        </div>
        <div className="detail-list">
          {details.map(([label, value]) => (
            <div key={label}><span>{label}</span><strong>{value}</strong></div>
          ))}
        </div>
        <p className="receipt-note">
          Customer account details are not displayed in the merchant portal.
        </p>
        {transaction.status === 'completed' ? (
          <button className="button button-primary button-full" onClick={onPrint}>
            Print confirmed receipt
          </button>
        ) : null}
      </section>
    </div>
  );
}
