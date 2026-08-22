import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_GROUPS = [
  {
    label: 'Operations',
    links: [
      { to: '/admin/orders', label: 'Orders', icon: '📦' },
      { to: '/admin/orders/new', label: 'Create order', icon: '➕' },
      { to: '/admin/zones', label: 'Zones', icon: '🗺️' },
      { to: '/admin/agents', label: 'Agents', icon: '🛵' },
      { to: '/admin/agents/pending', label: 'Agent approvals', icon: '🧑\u200d✈️' },
    ],
  },
  {
    label: 'Billing',
    links: [
      { to: '/admin/ratecards', label: 'Rate cards', icon: '💳' },
      { to: '/admin/codconfig', label: 'COD config', icon: '💰' },
    ],
  },
  {
    label: 'Access',
    links: [{ to: '/admin/users', label: 'Add admin', icon: '👤' }],
  },
];

export default function AdminLayout({ title, subtitle, headerAction, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = (user?.name || 'A')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <NavLink to="/admin/orders" className="admin-sidebar-brand">
          <span className="logo-ring" />
          LastMile Tracker
        </NavLink>

        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="admin-group-label">{group.label}</div>
            {group.links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                className={({ isActive }) => 'admin-link' + (isActive ? ' active' : '')}
              >
                <span>{l.icon}</span> {l.label}
              </NavLink>
            ))}
          </div>
        ))}

        <div className="admin-sidebar-foot">
          <span className="admin-sidebar-avatar">{initials}</span>
          <div>
            <b>{user?.name}</b>
            <span className="role-tag" style={{ marginLeft: 0 }}>
              ADMIN
            </span>
          </div>
        </div>
        <button className="btn btn-ghost small" style={{ marginTop: 10 }} onClick={handleLogout}>
          Log out
        </button>
      </aside>

      <main className="admin-main">
        <div className="admin-main-head">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {headerAction}
        </div>
        {children}
      </main>
    </div>
  );
}