import { useCallback, useEffect, useState } from 'react';

import { AdminApiError, getAdminHealth } from '../api';
import type { AdminHealth } from '../types';

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds % 60}s`;
}

export function HealthPage() {
  const [data, setData] = useState<AdminHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await getAdminHealth());
    } catch (failure) {
      setError(failure instanceof AdminApiError && failure.status === 403
        ? 'Your account is not authorized to view system health.'
        : 'Mori Pay could not read the system health. Try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <>
      <section className="page-heading">
        <div><p className="eyebrow">PLATFORM</p><h1>System health</h1><p>Live runtime signals for the Mori Pay API. This view refreshes automatically every 15 seconds.</p></div>
        <button type="button" className="button button-secondary refresh-button" disabled={loading} onClick={() => void load()}>Refresh now</button>
      </section>

      {loading && !data ? <div className="page-loading" role="status">Reading system health…</div> : null}
      {error ? <div className="page-error" role="alert"><p>{error}</p><button type="button" className="button button-secondary" onClick={() => void load()}>Retry</button></div> : null}

      {data ? (
        <>
          <div className="verification-banner" style={{ marginBottom: 18 }}>
            <span className={`verified-icon`} aria-hidden="true">{data.status === 'ok' ? '✓' : '!'}</span>
            <div>
              <strong>Runtime status</strong>
              <p>{data.environment} environment · uptime {formatUptime(data.uptimeSeconds)}</p>
            </div>
            <span className={`health-pill ${data.status}`}><span />{data.status.toUpperCase()}</span>
          </div>

          <div className="overview-grid">
            <article className="overview-card">
              <div className={`card-icon ${data.database.ok ? 'teal' : 'amber'}`}>⛁</div>
              <span className="card-label">DATABASE</span>
              <strong>{data.database.ok ? 'Connected' : 'Unreachable'}</strong>
              <small>Round trip {data.database.responseMs} ms</small>
            </article>
            <article className="overview-card">
              <div className="card-icon blue">⇶</div>
              <span className="card-label">WEBHOOKS AWAITING</span>
              <strong>{data.webhooks.awaitingProcessing.toLocaleString()}</strong>
              <small>{data.webhooks.failedProcessing.toLocaleString()} failed deliveries recorded</small>
            </article>
            <article className="overview-card">
              <div className="card-icon violet">♡</div>
              <span className="card-label">HEAP IN USE</span>
              <strong>{data.heapUsedMb.toLocaleString()} MB</strong>
              <small>Reported at {new Date(data.generatedAt).toLocaleTimeString()}</small>
            </article>
          </div>
        </>
      ) : null}
    </>
  );
}
