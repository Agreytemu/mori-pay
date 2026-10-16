import type { ReactNode } from 'react';

import type { AdminCapability } from '../types';

export type AdminTab = 'overview' | 'users' | 'transactions' | 'merchants' | 'settings' | 'staff' | 'audit';

const modules: Array<{ icon: string; name: string; tab: AdminTab; capability: AdminCapability }> = [
  { icon: '▦', name: 'Overview', tab: 'overview', capability: 'admin:overview' },
  { icon: '♙', name: 'Users', tab: 'users', capability: 'admin:user:read' },
  { icon: '↗', name: 'Transactions', tab: 'transactions', capability: 'admin:transaction:read' },
  { icon: '▤', name: 'Merchants', tab: 'merchants', capability: 'admin:merchant:read' },
  { icon: '⚙', name: 'System settings', tab: 'settings', capability: 'admin:settings:read' },
  { icon: '♧', name: 'Staff access', tab: 'staff', capability: 'admin:staff:manage' },
  { icon: '≡', name: 'Audit log', tab: 'audit', capability: 'admin:audit:read' },
];

export function AdminShell({
  firstName,
  activeTab,
  capabilities,
  staffRole,
  onTab,
  onSignOut,
  children,
}: {
  firstName: string;
  activeTab: AdminTab;
  capabilities: AdminCapability[];
  staffRole: string;
  onTab: (tab: AdminTab) => void;
  onSignOut: () => void;
  children: ReactNode;
}) {
  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <a className="sidebar-brand" href="/" aria-label="Mori Pay Admin home">
          <img src="/brand/mori-pay-mark.png" alt="" />
          <span>MORI <b>PAY</b><small>ADMIN CONSOLE</small></span>
        </a>
        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="Admin console sections">
          {modules.filter((module) => capabilities.includes(module.capability)).map((module) => (
            <button
              key={module.name}
              className={`nav-item ${module.tab === activeTab ? 'active' : ''}`}
              type="button"
              aria-current={module.tab === activeTab ? 'page' : undefined}
              onClick={() => onTab(module.tab)}
              title={module.name}
            >
              <span className="nav-icon" aria-hidden="true">{module.icon}</span>
              <span>{module.name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="access-card">
            <span className="access-dot" />
            <div><strong>Admin access</strong><small>Verified by Mori Pay</small></div>
          </div>
          <button className="signout-button" type="button" onClick={onSignOut}>
            <span aria-hidden="true">↪</span> Sign out
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><b>/</b><strong>{modules.find((item) => item.tab === activeTab)?.name}</strong></div>
          <div className="staff-chip">
            <span className="staff-avatar">{firstName.slice(0, 1).toUpperCase()}</span>
            <span><strong>{firstName}</strong><small>{staffRole.replaceAll('_', ' ')}</small></span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
