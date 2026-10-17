import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  AdminApiError,
  decideAdminKycSubmission,
  getAdminKycSubmission,
  listAdminKycSubmissions,
} from '../api';
import type {
  AdminKycDocumentType,
  AdminKycSubmissionDetail,
  AdminKycSubmissionPage,
  AdminKycSubmissionStatus,
} from '../types';

type StatusFilter = AdminKycSubmissionStatus | 'all';

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'pending', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All submissions' },
];

const DOCUMENT_LABELS: Record<AdminKycDocumentType, string> = {
  nida: 'National ID (NIDA)',
  passport: 'Passport',
  voters_card: "Voter's card",
};

function statusClass(status: AdminKycSubmissionStatus): string {
  if (status === 'approved') return 'status-active';
  if (status === 'rejected') return 'status-disabled';
  return 'status-pending';
}

export function KycReviewPage({ canReview }: { canReview: boolean }) {
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminKycSubmissionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<AdminKycSubmissionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await listAdminKycSubmissions(status, term, page));
    } catch (failure) {
      setError(
        failure instanceof AdminApiError && failure.status === 403
          ? 'Your account is not authorized to review identity submissions.'
          : 'Mori Pay could not load identity submissions. Try again.',
      );
    } finally {
      setLoading(false);
    }
  }, [page, status, term]);

  useEffect(() => {
    void load();
  }, [load]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = input.trim();
    setData(null);
    setSelected(null);
    setPage(1);
    setTerm(normalized);
  }

  async function openDetails(submissionId: string) {
    setDetailLoading(true);
    setDetailError('');
    setValidation('');
    setRejectionReason('');
    setNotice('');
    try {
      setSelected(await getAdminKycSubmission(submissionId));
    } catch {
      setDetailError('Mori Pay could not load this submission. Try again.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function decide(decision: 'approve' | 'reject') {
    if (!selected || busy) return;
    const reason = rejectionReason.trim();
    if (decision === 'reject' && reason.length < 3) {
      setValidation('Add a short reason (at least 3 characters) so the customer knows what to fix.');
      return;
    }
    if (decision === 'approve' && !window.confirm(`Approve ${selected.user.name}'s identity submission?`)) {
      return;
    }
    setValidation('');
    setBusy(true);
    setNotice('');
    try {
      await decideAdminKycSubmission(selected.id, decision, reason || undefined);
      setNoticeError(false);
      setNotice(
        decision === 'approve'
          ? 'Identity approved. The customer is now verified.'
          : 'Submission rejected. The customer can submit again.',
      );
      setSelected(null);
      await load();
    } catch (failure) {
      setNoticeError(true);
      setNotice(
        failure instanceof AdminApiError && failure.status === 403
          ? 'Your account is not authorized to review submissions.'
          : failure instanceof AdminApiError && failure.status === 409
            ? 'This submission was already reviewed by someone else.'
            : 'Mori Pay could not apply this decision. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="page-heading">
        <div>
          <p className="eyebrow">IDENTITY OPERATIONS</p>
          <h1>Identity verification</h1>
          <p>Review customer ID submissions. Approving upgrades the account to verified; rejecting lets the customer submit again.</p>
        </div>
        <button type="button" className="button button-secondary refresh-button" disabled={loading} onClick={() => void load()}>Refresh</button>
      </section>

      <section className="data-panel">
        <form className="search-form" onSubmit={submit}>
          <label htmlFor="kyc-search">Filter submissions (optional)</label>
          <div className="search-controls">
            <select value={status} onChange={(event) => { setStatus(event.target.value as StatusFilter); setPage(1); setSelected(null); }}>
              {STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input id="kyc-search" autoComplete="off" maxLength={80} value={input} onChange={(event) => setInput(event.target.value)} placeholder="Name, phone or member ID" />
            <button className="button button-primary" type="submit" disabled={loading}>Search</button>
          </div>
        </form>

        {notice ? <p className={`inline-note ${noticeError ? 'error' : 'success'}`} role="status" style={{ padding: '0 22px 12px' }}>{notice}</p> : null}
        {loading ? <div className="page-loading" role="status">Loading identity submissions…</div> : null}
        {!loading && error ? <div className="page-error" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => void load()}>Retry</button></div> : null}
        {!loading && !error && data && data.items.length === 0 ? <div className="table-empty">No {status === 'all' ? '' : status} submissions{term ? ' match that filter' : ''}.</div> : null}
        {!loading && !error && data?.items.length ? (
          <div className="table-scroll">
            <table>
              <thead><tr><th>CUSTOMER</th><th>CONTACT</th><th>DOCUMENT</th><th>SUBMITTED</th><th>STATUS</th><th></th></tr></thead>
              <tbody>
                {data.items.map((submission) => (
                  <tr key={submission.id}>
                    <td><strong>{submission.user.name}</strong><small>{submission.user.memberId} · {submission.user.tier} · KYC {submission.user.kycLevel}</small></td>
                    <td>{submission.user.phone ?? 'No phone'}</td>
                    <td>{DOCUMENT_LABELS[submission.documentType]}<small>···· {submission.documentNumberLast4}</small></td>
                    <td>{new Date(submission.submittedAt).toLocaleString()}{submission.reviewedAt ? <small>Reviewed {new Date(submission.reviewedAt).toLocaleString()}</small> : null}</td>
                    <td><span className={`record-status ${statusClass(submission.status)}`}>{submission.status}</span></td>
                    <td><button type="button" className="action-button" disabled={detailLoading} onClick={() => void openDetails(submission.id)}>Review</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {detailLoading ? <div className="page-loading" role="status">Loading submitted documents…</div> : null}
        {detailError ? <div className="page-error" role="alert">{detailError}</div> : null}

        {selected ? (
          <section className="detail-panel" aria-label="Identity submission">
            <div className="detail-heading">
              <div><p className="eyebrow">AUDITED DOCUMENT ACCESS</p><h2>{selected.user.name}</h2></div>
              <button className="button button-secondary" type="button" onClick={() => setSelected(null)}>Close</button>
            </div>
            <div className="detail-grid">
              <div><small>CONTACT</small><strong>{selected.user.phone ?? 'No phone'} · {selected.user.memberId}</strong></div>
              <div><small>ACCOUNT</small><strong>{selected.user.tier} · KYC {selected.user.kycLevel}</strong></div>
              <div><small>DOCUMENT</small><strong>{DOCUMENT_LABELS[selected.documentType]}</strong></div>
              <div><small>NUMBER</small><strong>{selected.documentNumber}</strong></div>
              <div><small>SUBMITTED</small><strong>{new Date(selected.submittedAt).toLocaleString()}</strong></div>
              <div><small>STATUS</small><strong><span className={`record-status ${statusClass(selected.status)}`}>{selected.status}</span></strong></div>
              {selected.reviewedBy ? <div><small>REVIEWED BY</small><strong>{selected.reviewedBy.name}</strong></div> : null}
              {selected.rejectionReason ? <div><small>REJECTION REASON</small><strong>{selected.rejectionReason}</strong></div> : null}
            </div>

            <div className="manage-section">
              <div className="detail-subheading">Submitted photo</div>
              <img src={selected.documentImage} alt="Customer identity document" style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)' }} />
            </div>

            {validation ? <small className="search-validation" role="alert">{validation}</small> : null}

            {canReview && selected.status === 'pending' ? (
              <div className="manage-section">
                <div className="detail-subheading">Decision</div>
                <div className="manage-row">
                  <label>Rejection reason (required to reject)<input value={rejectionReason} maxLength={300} onChange={(event) => setRejectionReason(event.target.value)} placeholder="e.g. photo is blurry and the number does not match" style={{ minWidth: 320 }} /></label>
                </div>
                <div className="manage-row">
                  <button type="button" className="button button-primary" disabled={busy} onClick={() => void decide('approve')}>Approve & verify</button>
                  <button type="button" className="action-button reject" disabled={busy} onClick={() => void decide('reject')}>Reject</button>
                </div>
              </div>
            ) : selected.status !== 'pending' ? (
              <p className="muted-text">This submission has already been reviewed.</p>
            ) : (
              <p className="muted-text">You do not have permission to decide on submissions.</p>
            )}
          </section>
        ) : null}

        {data ? (
          <div className="pagination">
            <span>{data.total.toLocaleString()} {status === 'all' ? 'total' : status} submissions</span>
            <div>
              <button type="button" className="button button-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
              <span>Page {page} of {Math.max(1, data.totalPages)}</span>
              <button type="button" className="button button-secondary" disabled={loading || page >= data.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          </div>
        ) : null}
      </section>

      <p className="privacy-note">Document numbers and photos are decrypted only for authorised reviewers. Every view and decision is recorded in the audit log.</p>
    </>
  );
}
