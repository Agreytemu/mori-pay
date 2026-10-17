import type { ReactNode } from 'react';

import type { AdminCapability } from '../types';

export type AdminTab =
  | 'overview'
  | 'reports'
  | 'users'
  | 'verification'
  | 'merchants'
  | 'transactions'
  | 'reconciliation'
  | 'webhooks'
  | 'sessions'
  | 'staff'
  | 'audit'
  | 'promotions'
  | 'health'
  | 'settings';

type NavItem = { icon: string; name: string; tab: AdminTab; capability: AdminCapability };

const groups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Workspace',
    items: [
      { icon: '▦', name: 'Overview', tab: 'overview', capability: 'admin:overview' },
      { icon: '◵', name: 'Reports & analytics', tab: 'reports', capability: 'admin:report:read' },
    ],
  },
  {
    label: 'Accounts',
    items: [
      { icon: '♙', name: 'Users', tab: 'users', capability: 'admin:user:read' },
      { icon: '⚿', name: 'Identity verification', tab: 'verification', capability: 'admin:user:read' },
      { icon: '▤', name: 'Merchants', tab: 'merchants', capability: 'admin:merchant:read' },
    ],
  },
  {
    label: 'Payments',
    items: [
      { icon: '↗', name: 'Transactions', tab: 'transactions', capability: 'admin:transaction:read' },
      { icon: '⇄', name: 'Reconciliation', tab: 'reconciliation', capability: 'admin:reconciliation:read' },
      { icon: '⇶', name: 'Webhook events', tab: 'webhooks', capability: 'admin:webhook:read' },
    ],
  },
  {
    label: 'Security & access',
    items: [
      { icon: '▣', name: 'Sessions & devices', tab: 'sessions', capability: 'admin:session:read' },
      { icon: '♧', name: 'Staff access', tab: 'staff', capability: 'admin:staff:manage' },
      { icon: '≡', name: 'Audit log', tab: 'audit', capability: 'admin:audit:read' },
    ],
  },
  {
    label: 'Content',
    items: [
      { icon: '★', name: 'Promotions', tab: 'promotions', capability: 'admin:promotion:read' },
    ],
  },
  {
    label: 'System',
    items: [
      { icon: '♡', name: 'System health', tab: 'health', capability: 'admin:health:read' },
      { icon: '⚙', name: 'System settings', tab: 'settings', capability: 'admin:settings:read' },
    ],
  },
];

const allItems = groups.flatMap((group) => group.items);
const itemGroupLabel = (tab: AdminTab) =>
  groups.find((group) => group.items.some((item) => item.tab === tab))?.label ?? 'Workspace';

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
  const isSuperAdmin = staffRole === 'super_admin';
  const visible = (item: NavItem) => isSuperAdmin || capabilities.includes(item.capability);

  return (
    <div className="admin-layout">
      <aside className="sidebar">
        <a className="sidebar-brand" href="/" aria-label="Mori Pay Admin home">
          <img src="/brand/mori-pay-mark.png" alt="" />
          <span>MORI <b>PAY</b><small>ADMIN CONSOLE</small></span>
        </a>

        {isSuperAdmin ? (
          <div className="super-admin-badge" title="Super Admin — full access to every module">
            <span className="super-admin-dot" />
            SUPER ADMIN • FULL ACCESS
          </div>
        ) : null}

        <nav className="sidebar-nav" aria-label="Admin console sections">
          {groups.map((group) => {
            const items = group.items.filter(visible);
            if (!items.length) return null;
            return (
              <div className="nav-group" key={group.label}>
                <div className="nav-group-label">{group.label}</div>
                {items.map((item) => (
                  <button
                    key={item.tab}
                    className={`nav-item ${item.tab === activeTab ? 'active' : ''}`}
                    type="button"
                    aria-current={item.tab === activeTab ? 'page' : undefined}
                    onClick={() => onTab(item.tab)}
                  >
                    <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                    <span>{item.name}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="access-card">
            <span className="access-dot" />
            <div>
              <strong>{isSuperAdmin ? 'Super Admin access' : 'Admin access'}</strong>
              <small>Verified by Mori Pay</small>
            </div>
          </div>
          <button className="signout-button" type="button" onClick={onSignOut}>
            <span aria-hidden="true">↪</span> Sign out
          </button>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>{itemGroupLabel(activeTab)}</span>
            <b>/</b>
            <strong>{allItems.find((item) => item.tab === activeTab)?.name}</strong>
          </div>
          <div className="topbar-actions">
            <span className={`role-pill ${isSuperAdmin ? 'role-pill--super' : ''}`}>
              {isSuperAdmin ? 'Super Admin • Full access' : staffRole.replaceAll('_', ' ')}
            </span>
            <div className="staff-chip">
              <span className="staff-avatar">{firstName.slice(0, 1).toUpperCase()}</span>
              <span>
                <strong>{firstName}</strong>
                <small>{staffRole.replaceAll('_', ' ')}</small>
              </span>
            </div>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
