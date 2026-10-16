import { useCallback, useEffect, useState, type FormEvent } from 'react';

import {
  AdminApiError,
  createAdminFeeRule,
  deleteAdminFeeRule,
  getAdminSystemSettings,
  updateAdminFeeRule,
  updateRegistrationFee,
} from '../api';
import { Alert } from './Alert';
import type { AdminFeeRule, AdminSystemSettings } from '../types';

function money(value: string | null): string {
  return value === null ? 'Not configured' : `TZS ${BigInt(value).toLocaleString()}`;
}

type FeeRuleDraft = {
  id: string | null;
  type: string;
  channel: string;
  flat: string;
  percentage: string;
  minAmount: string;
  maxAmount: string;
  active: boolean;
};

const EMPTY_DRAFT: FeeRuleDraft = {
  id: null,
  type: '',
  channel: '',
  flat: '0',
  percentage: '0',
  minAmount: '0',
  maxAmount: '',
  active: true,
};

function draftFrom(rule: AdminFeeRule): FeeRuleDraft {
  return {
    id: rule.id,
    type: rule.type,
    channel: rule.channel ?? '',
    flat: rule.flat,
    percentage: String(rule.percentage * 100),
    minAmount: rule.minAmount,
    maxAmount: rule.maxAmount ?? '',
    active: rule.active,
  };
}

function settingsError(failure: unknown, action: string): string {
  if (failure instanceof AdminApiError && failure.status === 403) return 'Your account is not authorized to change system settings.';
  if (failure instanceof AdminApiError && failure.status === 409) return 'That change conflicts with the current configuration. Refresh and try again.';
  if (failure instanceof AdminApiError && failure.status === 0) return 'Could not connect to Mori Pay. Check your connection.';
  return `Mori Pay could not ${action}. Try again shortly.`;
}

export function SystemSettingsPage({ canEdit }: { canEdit: boolean }) {
  const [settings, setSettings] = useState<AdminSystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [feeInput, setFeeInput] = useState('');
  const [savingFee, setSavingFee] = useState(false);

  const [draft, setDraft] = useState<FeeRuleDraft | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [ruleError, setRuleError] = useState('');
  const [busyRuleId, setBusyRuleId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const current = await getAdminSystemSettings();
      setSettings(current);
      setFeeInput(current.merchantRegistrationFee ?? '');
    } catch (failure) {
      setError(failure instanceof AdminApiError && failure.status === 403
        ? 'Your account is not authorized to view system settings.'
        : 'Mori Pay could not load system settings. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function saveFee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(feeInput);
    if (!Number.isSafeInteger(amount) || amount <= 0 || savingFee) {
      setError('Enter a whole TZS amount greater than zero.');
      return;
    }
    if (!window.confirm(`Set the merchant registration fee to TZS ${amount.toLocaleString()} for new applications?`)) return;
    setSavingFee(true);
    setError('');
    try {
      const updated = await updateRegistrationFee(amount);
      setNotice('Registration fee updated for new applications.');
      setSettings((current) => current ? { ...current, merchantRegistrationFee: updated.amount == null ? null : String(updated.amount) } : current);
    } catch (failure) {
      setError(settingsError(failure, 'update the registration fee'));
    } finally {
      setSavingFee(false);
    }
  }

  function validateDraft(value: FeeRuleDraft): string {
    if (!value.type.trim()) return 'A movement type is required (for example "withdrawal").';
    const flat = Number(value.flat);
    const percentage = Number(value.percentage);
    const minAmount = Number(value.minAmount);
    if (!Number.isSafeInteger(flat) || flat < 0) return 'The flat fee must be a whole number of TZS, zero or more.';
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) return 'The rate must be between 0 and 100 percent.';
    if (!Number.isSafeInteger(minAmount) || minAmount < 0) return 'The minimum amount must be a whole number of TZS, zero or more.';
    if (value.maxAmount.trim()) {
      const maxAmount = Number(value.maxAmount);
      if (!Number.isSafeInteger(maxAmount) || maxAmount < 0) return 'The maximum amount must be a whole number of TZS, zero or more.';
      if (maxAmount < minAmount) return 'The maximum amount must be greater than or equal to the minimum.';
    }
    return '';
  }

  async function saveRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || savingRule) return;
    const validation = validateDraft(draft);
    if (validation) {
      setRuleError(validation);
      return;
    }
    setRuleError('');
    setSavingRule(true);
    setError('');
    const payload = {
      type: draft.type.trim(),
      channel: draft.channel.trim() || null,
      flat: Number(draft.flat),
      percentage: Number(draft.percentage) / 100,
      minAmount: Number(draft.minAmount),
      maxAmount: draft.maxAmount.trim() ? Number(draft.maxAmount) : null,
      active: draft.active,
    };
    try {
      if (draft.id) {
        await updateAdminFeeRule(draft.id, payload);
        setNotice('Fee rule updated.');
      } else {
        await createAdminFeeRule(payload);
        setNotice('Fee rule created.');
      }
      setDraft(null);
      await load();
    } catch (failure) {
      setRuleError(settingsError(failure, 'save this fee rule'));
    } finally {
      setSavingRule(false);
    }
  }

  async function toggleRule(rule: AdminFeeRule) {
    if (busyRuleId) return;
    setBusyRuleId(rule.id);
    setError('');
    try {
      await updateAdminFeeRule(rule.id, { active: !rule.active });
      setNotice(`Fee rule ${rule.active ? 'deactivated' : 'activated'}.`);
      await load();
    } catch (failure) {
      setError(settingsError(failure, 'update this fee rule'));
    } finally {
      setBusyRuleId('');
    }
  }

  async function removeRule(rule: AdminFeeRule) {
    if (busyRuleId) return;
    if (!window.confirm(`Delete the ${rule.type}${rule.channel ? ` · ${rule.channel}` : ''} fee rule? This cannot be undone.`)) return;
    setBusyRuleId(rule.id);
    setError('');
    try {
      await deleteAdminFeeRule(rule.id);
      setNotice('Fee rule deleted.');
      if (draft?.id === rule.id) setDraft(null);
      await load();
    } catch (failure) {
      setError(settingsError(failure, 'delete this fee rule'));
    } finally {
      setBusyRuleId('');
    }
  }

  if (loading) return <div className="page-loading" role="status">Loading system settings…</div>;
  if (error && !settings) {
    return <section className="page-error" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => void load()}>Retry</button></section>;
  }
  if (!settings) return null;

  const tiers = [
    { label: 'Standard', limit: settings.tierLimits.standard },
    { label: 'Verified', limit: settings.tierLimits.verified },
  ];

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">PLATFORM OPERATIONS</p><h1>System settings</h1><p>{canEdit ? 'Manage fee rules, the merchant registration fee, and review configured limits and integrations.' : 'Read-only view of effective fee rules, configured limits, and integration configuration.'}</p></div>
        <button type="button" className="button button-secondary refresh-button" onClick={() => void load()}>Refresh</button>
      </section>
      {error ? <Alert tone="error" onDismiss={() => setError('')}>{error}</Alert> : null}
      {notice ? <Alert tone="success" onDismiss={() => setNotice('')}>{notice}</Alert> : null}

      <section className="settings-grid">
        <article className="settings-card">
          <p className="eyebrow">MERCHANTS</p><h2>Registration fee</h2>
          <strong>{money(settings.merchantRegistrationFee)}</strong>
          {canEdit ? (
            <form className="fee-controls" onSubmit={(event) => void saveFee(event)}>
              <input aria-label="Registration fee (TZS)" type="number" min="1" step="1" max={Number.MAX_SAFE_INTEGER} value={feeInput} onChange={(event) => setFeeInput(event.target.value)} placeholder="Not configured" />
              <button className="button button-primary" type="submit" disabled={savingFee}>{savingFee ? 'Saving…' : 'Save'}</button>
            </form>
          ) : null}
          <small>New merchant applications only. Existing application fees remain unchanged.</small>
        </article>
        <article className="settings-card"><p className="eyebrow">RECONCILIATION</p><h2>{settings.reconciliation.enabled ? 'Enabled' : 'Disabled'}</h2><strong>{settings.reconciliation.intervalSeconds}s interval</strong><small>Stale transaction threshold: {settings.reconciliation.staleSeconds}s. This is configuration state, not a live provider health check.</small></article>
      </section>

      <section className="data-panel settings-section">
        <div className="panel-heading"><div><h2>Transaction limits</h2><p>Configured per-tier ceilings, set for this deployment.</p></div></div>
        <div className="settings-grid">{tiers.map(({ label, limit }) => <article className="settings-card compact" key={label}><h2>{label}</h2><div><small>Daily outflow</small><strong>{money(limit.dailyOutflow)}</strong></div><div><small>Per transaction</small><strong>{money(limit.perTransaction)}</strong></div></article>)}</div>
        <p className="muted-text">Per-tier limits are provided by the deployment environment. Change them in the server configuration and redeploy to update this view.</p>
      </section>

      <section className="data-panel settings-section">
        <div className="panel-heading">
          <div><h2>Fee rules</h2><p>{settings.feeRules.length} rule records. {canEdit ? 'Create and edit the rules that price each movement.' : 'No fee values can be changed here.'}</p></div>
          {canEdit ? <button type="button" className="button button-primary" onClick={() => { setRuleError(''); setDraft({ ...EMPTY_DRAFT }); }}>New fee rule</button> : null}
        </div>
        {settings.feeRules.length ? <div className="table-scroll"><table><thead><tr><th>TYPE / CHANNEL</th><th>FLAT</th><th>RATE</th><th>AMOUNT RANGE</th><th>STATUS</th>{canEdit ? <th>ACTIONS</th> : null}</tr></thead><tbody>
          {settings.feeRules.map((rule) => <tr key={rule.id}><td><strong>{rule.type}</strong><small>{rule.channel ?? 'All channels'}</small></td><td>{money(rule.flat)}</td><td>{(rule.percentage * 100).toLocaleString(undefined, { maximumFractionDigits: 4 })}%</td><td>{money(rule.minAmount)} – {money(rule.maxAmount)}</td><td><span className={`record-status status-${rule.active ? 'active' : 'revoked'}`}>{rule.active ? 'Active' : 'Inactive'}</span></td>{canEdit ? <td><div className="row-actions"><button type="button" className="action-button" disabled={Boolean(busyRuleId)} onClick={() => { setRuleError(''); setDraft(draftFrom(rule)); }}>Edit</button><button type="button" className="action-button" disabled={Boolean(busyRuleId)} onClick={() => void toggleRule(rule)}>{rule.active ? 'Deactivate' : 'Activate'}</button><button type="button" className="action-button reject" disabled={Boolean(busyRuleId)} onClick={() => void removeRule(rule)}>Delete</button></div></td> : null}</tr>)}
        </tbody></table></div> : <div className="table-empty">No fee rules are configured.</div>}

        {canEdit && draft ? (
          <form className="fee-rule-form" onSubmit={(event) => void saveRule(event)}>
            <div className="detail-subheading">{draft.id ? 'Edit fee rule' : 'New fee rule'}</div>
            <div className="manage-row">
              <label>Movement type<input value={draft.type} maxLength={60} onChange={(event) => setDraft({ ...draft, type: event.target.value })} placeholder="e.g. withdrawal" required /></label>
              <label>Channel (optional)<input value={draft.channel} maxLength={60} onChange={(event) => setDraft({ ...draft, channel: event.target.value })} placeholder="e.g. mobile_money" /></label>
              <label className="checkbox-label"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} /> Active</label>
            </div>
            <div className="manage-row">
              <label>Flat fee (TZS)<input type="number" min={0} step={1} value={draft.flat} onChange={(event) => setDraft({ ...draft, flat: event.target.value })} /></label>
              <label>Rate (%)<input type="number" min={0} max={100} step="0.0001" value={draft.percentage} onChange={(event) => setDraft({ ...draft, percentage: event.target.value })} /></label>
              <label>Minimum amount (TZS)<input type="number" min={0} step={1} value={draft.minAmount} onChange={(event) => setDraft({ ...draft, minAmount: event.target.value })} /></label>
              <label>Maximum amount (TZS, optional)<input type="number" min={0} step={1} value={draft.maxAmount} onChange={(event) => setDraft({ ...draft, maxAmount: event.target.value })} placeholder="No maximum" /></label>
            </div>
            {ruleError ? <small className="search-validation" role="alert">{ruleError}</small> : null}
            <div className="manage-row">
              <button className="button button-primary" type="submit" disabled={savingRule}>{savingRule ? 'Saving…' : draft.id ? 'Save changes' : 'Create fee rule'}</button>
              <button className="button button-secondary" type="button" disabled={savingRule} onClick={() => { setDraft(null); setRuleError(''); }}>Cancel</button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="data-panel settings-section">
        <div className="panel-heading"><div><h2>Integration configuration</h2><p>Presence checks only; credentials and provider connectivity are not displayed or tested here.</p></div></div>
        <div className="integration-list">{settings.integrations.map((integration) => <div key={integration.name}><strong>{integration.name}</strong><span className={`record-status status-${integration.configuration === 'configured' ? 'active' : 'pending_payment'}`}>{integration.configuration}</span></div>)}</div>
      </section>
      <p className="privacy-note">Displayed at {new Date(settings.generatedAt).toLocaleString()}. Every fee change is recorded in the audit log. Per-tier limits and provider credentials are managed through the deployment environment.</p>
    </>
  );
}
