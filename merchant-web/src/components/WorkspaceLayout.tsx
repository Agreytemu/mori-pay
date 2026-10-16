import type { ReactNode } from 'react';
import { Brand } from './Brand';

export type WorkspaceTab = 'overview' | 'transactions' | 'reports' | 'qr' | 'business';

const items: { id: WorkspaceTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'transactions', label: 'Transactions', icon: 'transactions' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'qr', label: 'QR codes', icon: 'qr' },
  { id: 'business', label: 'Business', icon: 'business' },
];

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    overview: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="11" width="7" height="10" rx="1.5" /><rect x="3" y="14" width="8" height="7" rx="1.5" /></>,
    transactions: <><path d="M7 7h13m0 0-4-4m4 4-4 4M17 17H4m0 0 4 4m-4-4 4-4" /></>,
    reports: <><path d="M5 3h10l4 4v14H5z" /><path d="M14 3v5h5M8 12h8M8 16h8" /></>,
    qr: <><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM19 14v2m2 2v3h-4" /></>,
    business: <><path d="M3 21V8l9-5 9 5v13M3 12h18M8 21v-5h8v5" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function WorkspaceLayout({
  active,
  merchantStatus,
  title,
  subtitle,
  loading,
  busy,
  children,
  onTab,
  onRefresh,
  onSignOut,
}: {
  active: WorkspaceTab;
  merchantStatus?: string;
  title: string;
  subtitle: string;
  loading: boolean;
  busy: boolean;
  children: ReactNode;
  onTab: (tab: WorkspaceTab) => void;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-caption">YOUR BUSINESS WORKSPACE</div>
        <nav className="side-nav" aria-label="Merchant workspace">
          {items.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${active === item.id ? 'active' : ''}`}
              onClick={() => onTab(item.id)}
              aria-current={active === item.id ? 'page' : undefined}
            >
              <span className="nav-icon"><NavIcon name={item.icon} /></span>
              {item.label}
              {active === item.id ? <span className="nav-active-dot" /> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon">?</span>
            <strong>We’re here to help</strong>
            <span>Contact Mori Pay support about business profile changes or your application.</span>
          </div>
          <div className="user-card">
            <div className="avatar">M</div>
            <div className="user-info"><strong>Mori Pay account</strong><span>Authenticated session</span></div>
            <button className="icon-button" aria-label="Sign out" title="Sign out" onClick={onSignOut}>↗</button>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Mori Pay</span><b>/</b><strong>Merchant portal</strong></div>
          <div className="topbar-actions">
            <span className={`account-pill ${merchantStatus === 'active' ? 'good' : ''}`}>
              <i />{merchantStatus ? labelStatus(merchantStatus) : 'Application access'}
            </span>
            <button className="button button-quiet" onClick={onSignOut} disabled={busy}>Sign out</button>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">MORI PAY MERCHANT PORTAL</span>
              <h1>{title}</h1>
              <p className="muted">{subtitle}</p>
            </div>
            <button className="button button-light refresh-button" onClick={onRefresh} disabled={loading}>
              <span className={loading ? 'spin' : ''} aria-hidden="true">↻</span>
              <span>{loading ? 'Refreshing' : 'Refresh data'}</span>
            </button>
          </div>
          {children}
          <footer className="app-footer">
            Mori Pay · Application reviews and merchant access are verified by the official server.
          </footer>
        </div>
      </main>
    </div>
  );
}

function labelStatus(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}
