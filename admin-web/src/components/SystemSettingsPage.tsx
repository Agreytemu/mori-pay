import { useEffect, useState } from 'react';

import { AdminApiError, getAdminSystemSettings } from '../api';
import type { AdminSystemSettings } from '../types';

function money(value: string | null): string {
  return value === null ? 'Not configured' : `TZS ${BigInt(value).toLocaleString()}`;
}

export function SystemSettingsPage() {
  const [settings, setSettings] = useState<AdminSystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setSettings(await getAdminSystemSettings());
    } catch (failure) {
      setError(failure instanceof AdminApiError && failure.status === 403
        ? 'Your account is not authorized to view system settings.'
        : 'Mori Pay could not load system settings. Try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (loading) return <div className="page-loading" role="status">Loading system settings…</div>;
  if (error || !settings) {
    return <section className="page-error" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => void load()}>Retry</button></section>;
  }

  const tiers = [
    { label: 'Standard', limit: settings.tierLimits.standard },
    { label: 'Verified', limit: settings.tierLimits.verified },
  ];

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">PLATFORM OPERATIONS</p><h1>System settings</h1><p>Read-only view of effective fee rules, configured limits, and integration configuration.</p></div>
        <button type="button" className="button button-secondary refresh-button" onClick={() => void load()}>Refresh</button>
      </section>
      <section className="settings-grid">
        <article className="settings-card"><p className="eyebrow">MERCHANTS</p><h2>Registration fee</h2><strong>{money(settings.merchantRegistrationFee)}</strong><small>New merchant applications only. Existing application fees remain unchanged.</small></article>
        <article className="settings-card"><p className="eyebrow">RECONCILIATION</p><h2>{settings.reconciliation.enabled ? 'Enabled' : 'Disabled'}</h2><strong>{settings.reconciliation.intervalSeconds}s interval</strong><small>Stale transaction threshold: {settings.reconciliation.staleSeconds}s. This is configuration state, not a live provider health check.</small></article>
      </section>
      <section className="data-panel settings-section">
        <div className="panel-heading"><div><h2>Transaction limits</h2><p>Configured per-tier ceilings; shown for operational visibility only.</p></div></div>
        <div className="settings-grid">{tiers.map(({ label, limit }) => <article className="settings-card compact" key={label}><h2>{label}</h2><div><small>Daily outflow</small><strong>{money(limit.dailyOutflow)}</strong></div><div><small>Per transaction</small><strong>{money(limit.perTransaction)}</strong></div></article>)}</div>
      </section>
      <section className="data-panel settings-section">
        <div className="panel-heading"><div><h2>Fee rules</h2><p>{settings.feeRules.length} active and inactive rule records. No fee values can be changed here.</p></div></div>
        {settings.feeRules.length ? <div className="table-scroll"><table><thead><tr><th>TYPE / CHANNEL</th><th>FLAT</th><th>RATE</th><th>AMOUNT RANGE</th><th>STATUS</th></tr></thead><tbody>
          {settings.feeRules.map((rule, index) => <tr key={`${rule.type}-${rule.channel}-${rule.minAmount}-${index}`}><td><strong>{rule.type}</strong><small>{rule.channel ?? 'All channels'}</small></td><td>{money(rule.flat)}</td><td>{(rule.percentage * 100).toLocaleString(undefined, { maximumFractionDigits: 4 })}%</td><td>{money(rule.minAmount)} – {money(rule.maxAmount)}</td><td><span className={`record-status status-${rule.active ? 'active' : 'revoked'}`}>{rule.active ? 'Active' : 'Inactive'}</span></td></tr>)}
        </tbody></table></div> : <div className="table-empty">No fee rules are configured.</div>}
      </section>
      <section className="data-panel settings-section">
        <div className="panel-heading"><div><h2>Integration configuration</h2><p>Presence checks only; credentials and provider connectivity are not displayed or tested here.</p></div></div>
        <div className="integration-list">{settings.integrations.map((integration) => <div key={integration.name}><strong>{integration.name}</strong><span className={`record-status status-${integration.configuration === 'configured' ? 'active' : 'pending_payment'}`}>{integration.configuration}</span></div>)}</div>
      </section>
      <p className="privacy-note">Displayed at {new Date(settings.generatedAt).toLocaleString()}. Changes to fee/limit policy and provider configuration require approval and must be performed through an audited, server-side workflow.</p>
    </>
  );
}
