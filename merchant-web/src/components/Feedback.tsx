import type { ReactNode } from 'react';
import type { MerchantPortalTransaction } from '../types';
import { formatDate, formatMoney, labelValue } from '../utils/format';

export function Alert({
  tone,
  children,
  onDismiss,
}: {
  tone: 'error' | 'success';
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div className={`alert ${tone}`} role="alert">
      <span>{tone === 'error' ? '!' : '✓'}</span>
      <p>{children}</p>
      {onDismiss ? <button aria-label="Dismiss" onClick={onDismiss}>×</button> : null}
    </div>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const tone = ['completed', 'active'].includes(normalized)
    ? 'success'
    : ['pending', 'processing'].includes(normalized)
      ? 'pending'
      : 'muted';
  return (
    <span className={`status-badge ${tone}`}>
      <i />
      {labelValue(value)}
    </span>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">◌</span>
      <strong>Nothing to show yet</strong>
      <p>{text}</p>
    </div>
  );
}

export function TransactionRow({
  item,
  onClick,
}: {
  item: MerchantPortalTransaction;
  onClick: () => void;
}) {
  return (
    <button className="activity-row" onClick={onClick}>
      <span className="activity-icon" aria-hidden="true">↗</span>
      <span className="activity-main">
        <strong>{item.reference}</strong>
        <small>{formatDate(item.settledAt ?? item.createdAt)} · {labelValue(item.channel)}</small>
      </span>
      <strong className="activity-amount">
        {formatMoney(item.merchantAmount, item.currency)}
      </strong>
      <StatusBadge value={item.status} />
      <span className="row-arrow" aria-hidden="true">→</span>
    </button>
  );
}
