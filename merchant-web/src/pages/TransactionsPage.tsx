import type { KeyboardEvent } from 'react';
import type { MerchantPortalTransaction } from '../types';
import { Empty, StatusBadge } from '../components/Feedback';
import { formatDate, formatMoney, labelValue } from '../utils/format';

export function TransactionsPage({
  items,
  total,
  page,
  pageCount,
  loading,
  search,
  status,
  type,
  channel,
  onSearch,
  onStatus,
  onType,
  onChannel,
  onPage,
  onTransaction,
}: {
  items: MerchantPortalTransaction[];
  total: number;
  page: number;
  pageCount: number;
  loading: boolean;
  search: string;
  status: string;
  type: string;
  channel: string;
  onSearch: (value: string) => void;
  onStatus: (value: string) => void;
  onType: (value: string) => void;
  onChannel: (value: string) => void;
  onPage: (page: number) => void;
  onTransaction: (transaction: MerchantPortalTransaction) => void;
}) {
  const selectRow = (event: KeyboardEvent<HTMLTableRowElement>, item: MerchantPortalTransaction) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onTransaction(item);
    }
  };
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">PAYMENT HISTORY</span>
          <h2>Transactions</h2>
          <p className="muted">
            Search confirmed payments and open a record for details or a receipt.
          </p>
        </div>
      </div>
      <div className="table-filters">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search reference or transaction ID"
            aria-label="Search transaction reference or ID"
          />
        </label>
        <select aria-label="Filter by status" value={status} onChange={(event) => onStatus(event.target.value)}>
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select aria-label="Filter by type" value={type} onChange={(event) => onType(event.target.value)}>
          <option value="">All types</option><option value="payment">Payment</option>
        </select>
        <select aria-label="Filter by method" value={channel} onChange={(event) => onChannel(event.target.value)}>
          <option value="">All methods</option><option value="wallet">Mori Pay wallet</option>
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>REFERENCE / DATE</th><th>TYPE</th><th>METHOD</th><th>RECEIVED</th><th>STATUS</th><th /></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => onTransaction(item)}
                onKeyDown={(event) => selectRow(event, item)}
                tabIndex={0}
                aria-label={`Transaction ${item.reference}, ${item.status}, ${formatMoney(item.merchantAmount, item.currency)}`}
              >
                <td><strong>{item.reference}</strong><span className="table-sub">{formatDate(item.settledAt ?? item.createdAt)}</span></td>
                <td>{labelValue(item.type)}</td>
                <td>{labelValue(item.channel)}</td>
                <td className="amount-cell">{formatMoney(item.merchantAmount, item.currency)}</td>
                <td><StatusBadge value={item.status} /></td>
                <td><span className="row-arrow" aria-hidden="true">→</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {loading ? (
        <div className="table-loading"><span className="loader" /> Loading transactions…</div>
      ) : !items.length ? <Empty text="No transactions match these filters." /> : null}
      <div className="pagination">
        <span>{total.toLocaleString()} transactions · page {page} of {pageCount}</span>
        <div>
          <button
            className="button button-light"
            disabled={page <= 1 || loading}
            onClick={() => onPage(Math.max(1, page - 1))}
          >
            ← Previous
          </button>
          <button
            className="button button-light"
            disabled={page >= pageCount || loading}
            onClick={() => onPage(Math.min(pageCount, page + 1))}
          >
            Next →
          </button>
        </div>
      </div>
    </section>
  );
}
