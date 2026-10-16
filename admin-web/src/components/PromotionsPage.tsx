import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  AdminApiError,
  createAdminPromotion,
  deleteAdminPromotion,
  listAdminPromotions,
  updateAdminPromotion,
} from '../api';
import type { Promotion, PromotionInput, PromotionPage, PromotionPlacement } from '../types';

const PLACEMENTS: Array<{ value: PromotionPlacement; label: string }> = [
  { value: 'home_banner', label: 'Home banner' },
  { value: 'wallet_banner', label: 'Wallet banner' },
  { value: 'notification', label: 'Notification' },
];

const PLACEMENT_LABELS: Record<PromotionPlacement, string> = {
  home_banner: 'Home banner',
  wallet_banner: 'Wallet banner',
  notification: 'Notification',
};

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(local: string): string | undefined {
  if (!local) return undefined;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

type FormState = {
  title: string;
  body: string;
  placement: PromotionPlacement;
  imageUrl: string;
  active: boolean;
  startsAt: string;
  endsAt: string;
};

const EMPTY_FORM: FormState = {
  title: '',
  body: '',
  placement: 'home_banner',
  imageUrl: '',
  active: true,
  startsAt: '',
  endsAt: '',
};

export function PromotionsPage({ canManage }: { canManage: boolean }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PromotionPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeError, setNoticeError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await listAdminPromotions(page, 20));
    } catch (failure) {
      setError(failure instanceof AdminApiError && failure.status === 403
        ? 'Your account is not authorized to view promotions.'
        : 'Mori Pay could not load promotions. Try again.');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setValidation('');
  }

  function startEdit(promotion: Promotion) {
    setEditingId(promotion.id);
    setValidation('');
    setNotice('');
    setForm({
      title: promotion.title,
      body: promotion.body,
      placement: promotion.placement,
      imageUrl: promotion.imageUrl ?? '',
      active: promotion.active,
      startsAt: toLocalInput(promotion.startsAt),
      endsAt: toLocalInput(promotion.endsAt),
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const title = form.title.trim();
    const body = form.body.trim();
    if (title.length < 2 || title.length > 120) {
      setValidation('Enter a title between 2 and 120 characters.');
      return;
    }
    if (body.length < 2 || body.length > 400) {
      setValidation('Enter a message between 2 and 400 characters.');
      return;
    }
    if (form.startsAt && form.endsAt && form.startsAt > form.endsAt) {
      setValidation('The start date must be before the end date.');
      return;
    }
    setValidation('');
    setBusy(true);
    setNotice('');
    const payload: PromotionInput = {
      title,
      body,
      placement: form.placement,
      active: form.active,
      ...(form.imageUrl.trim() ? { imageUrl: form.imageUrl.trim() } : {}),
      ...(toIso(form.startsAt) ? { startsAt: toIso(form.startsAt) as string } : {}),
      ...(toIso(form.endsAt) ? { endsAt: toIso(form.endsAt) as string } : {}),
    };
    try {
      if (editingId) {
        await updateAdminPromotion(editingId, payload);
        setNoticeError(false);
        setNotice('Promotion updated.');
      } else {
        await createAdminPromotion(payload);
        setNoticeError(false);
        setNotice('Promotion created.');
      }
      resetForm();
      await load();
    } catch (failure) {
      setNoticeError(true);
      setNotice(failure instanceof AdminApiError && failure.status === 403
        ? 'Your account is not authorized to change promotions.'
        : 'Mori Pay could not save this promotion. Check the fields and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(promotion: Promotion) {
    setNotice('');
    try {
      await updateAdminPromotion(promotion.id, { active: !promotion.active });
      setNoticeError(false);
      setNotice(`Promotion ${promotion.active ? 'paused' : 'activated'}.`);
      await load();
    } catch {
      setNoticeError(true);
      setNotice('Mori Pay could not change this promotion. Try again.');
    }
  }

  async function remove(promotion: Promotion) {
    if (!window.confirm(`Delete “${promotion.title}”? This cannot be undone.`)) return;
    setNotice('');
    try {
      await deleteAdminPromotion(promotion.id);
      setNoticeError(false);
      setNotice('Promotion deleted.');
      if (editingId === promotion.id) resetForm();
      await load();
    } catch {
      setNoticeError(true);
      setNotice('Mori Pay could not delete this promotion. Try again.');
    }
  }

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">CONTENT</p><h1>Promotions &amp; banners</h1><p>In-app banners and notifications shown to customers. Scheduled windows are optional.</p></div>
        <button type="button" className="button button-secondary refresh-button" disabled={loading} onClick={() => void load()}>Refresh</button>
      </section>

      {canManage ? (
        <section className="data-panel" style={{ marginBottom: 18 }}>
          <div className="panel-heading"><div><h2>{editingId ? 'Edit promotion' : 'New promotion'}</h2><p>{editingId ? 'Update the selected promotion.' : 'Create a banner or notification for customers.'}</p></div></div>
          <form className="form-panel form-grid" onSubmit={submit}>
            <label className="wide">Title<input maxLength={120} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Zero fees this weekend" /></label>
            <label className="wide">Message<textarea maxLength={400} value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} placeholder="Short, customer-facing copy" /></label>
            <label>Placement<select value={form.placement} onChange={(event) => setForm((current) => ({ ...current, placement: event.target.value as PromotionPlacement }))}>{PLACEMENTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>Image URL (optional)<input value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="https://…" /></label>
            <label>Starts at<input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} /></label>
            <label>Ends at<input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} /></label>
            <label className="checkbox-row wide"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /> Active immediately</label>
            <div className="form-actions wide">
              <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create promotion'}</button>
              {editingId ? <button className="button button-secondary" type="button" onClick={resetForm}>Cancel edit</button> : null}
              {validation ? <small className="search-validation" role="alert">{validation}</small> : null}
            </div>
          </form>
        </section>
      ) : null}

      <section className="data-panel">
        <div className="panel-heading"><div><h2>All promotions</h2><p>{data?.total.toLocaleString() ?? 0} total.</p></div></div>
        {notice ? <p className={`inline-note ${noticeError ? 'error' : 'success'}`} role="status" style={{ padding: '0 22px 12px' }}>{notice}</p> : null}
        {loading ? <div className="page-loading" role="status">Loading promotions…</div> : null}
        {!loading && error ? <div className="page-error" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => void load()}>Retry</button></div> : null}
        {!loading && !error && data?.items.length === 0 ? <div className="table-empty">No promotions yet.</div> : null}
        {!loading && !error && data?.items.length ? (
          <div className="table-scroll"><table><thead><tr><th>TITLE</th><th>PLACEMENT</th><th>STATUS</th><th>WINDOW</th><th>UPDATED</th>{canManage ? <th></th> : null}</tr></thead><tbody>
            {data.items.map((promotion) => (
              <tr key={promotion.id}>
                <td><strong>{promotion.title}</strong><small>{promotion.body}</small></td>
                <td>{PLACEMENT_LABELS[promotion.placement]}</td>
                <td><span className={`record-status ${promotion.active ? 'status-active' : 'status-disabled'}`}>{promotion.active ? 'active' : 'paused'}</span></td>
                <td>{promotion.startsAt ? new Date(promotion.startsAt).toLocaleString() : 'Anytime'}<small>{promotion.endsAt ? `until ${new Date(promotion.endsAt).toLocaleString()}` : 'no end date'}</small></td>
                <td>{new Date(promotion.updatedAt).toLocaleString()}</td>
                {canManage ? (
                  <td><div className="row-actions">
                    <button type="button" className="action-button" onClick={() => startEdit(promotion)}>Edit</button>
                    <button type="button" className="action-button" onClick={() => void toggleActive(promotion)}>{promotion.active ? 'Pause' : 'Activate'}</button>
                    <button type="button" className="action-button reject" onClick={() => void remove(promotion)}>Delete</button>
                  </div></td>
                ) : null}
              </tr>
            ))}
          </tbody></table></div>
        ) : null}
        <div className="pagination"><span>{data?.total.toLocaleString() ?? 0} promotions</span><div><button type="button" className="button button-secondary" disabled={loading || page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {Math.max(1, data?.totalPages ?? 1)}</span><button type="button" className="button button-secondary" disabled={loading || page >= (data?.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
      </section>
    </>
  );
}
