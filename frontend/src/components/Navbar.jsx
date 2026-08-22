import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linksByRole = {
    customer: [
      { to: '/customer/place-order', label: 'Place order' },
      { to: '/customer/orders', label: 'My orders' },
    ],
    agent: [{ to: '/agent', label: 'My deliveries' }],
    admin: [
      { to: '/admin/orders', label: 'Orders' },
      { to: '/admin/zones', label: 'Zones' },
      { to: '/admin/ratecards', label: 'Rate cards' },
      { to: '/admin/codconfig', label: 'COD config' },
      { to: '/admin/agents/pending', label: 'Agent approvals' },
      { to: '/admin/users', label: 'Add admin' },
    ],
  };

  const links = linksByRole[user.role] || [];

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <span className="brand">LastMile Tracker</span>
        <nav className="nav-links">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="navbar-user">
          <span className="user-chip">
            {user.name} <span className="role-tag">{user.role}</span>
          </span>
          <button className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}