/**
 * Layout.jsx
 * ----------
 * The frame around every logged-in page: left Sidebar + top bar.
 * The current page is rendered where <Outlet /> is.
 *
 * Menu items are hidden when the user's role lacks the permission
 * (Module 3 on the frontend). The backend ALSO checks permissions,
 * so hiding a link is only for a clean UI, not for security.
 */
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import {
  Home, User, UserCog, Building2, IdCard, CreditCard, Settings2, FileText, Settings,
  LogOut, Search, Bell, ChevronDown, CalendarDays, ArrowRight, Truck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { BrandMark, PromoArt } from './Artwork';
import { formatDate } from '../utils/format';

// One entry per sidebar link. `perm` = permission needed to see it (null = everyone).
export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: Home, perm: 'DASHBOARD_VIEW', end: true },
  { to: '/users', label: 'User Management', icon: User, perm: 'USER_VIEW' },
  { to: '/roles', label: 'Role & Permissions', icon: UserCog, perm: 'ROLE_VIEW' },
  { to: '/branches', label: 'Branch Management', icon: Building2, perm: 'BRANCH_VIEW' },
  { to: '/company', label: 'Company Profile', icon: IdCard, perm: 'COMPANY_VIEW' },
  { to: '/subscriptions', label: 'Subscription Management', icon: CreditCard, perm: 'SUBSCRIPTION_VIEW' },
  { to: '/configuration', label: 'Configuration', icon: Settings2, perm: 'SETTINGS_VIEW' },
  { to: '/audit-logs', label: 'Audit Logs', icon: FileText, perm: 'AUDIT_VIEW' },
  { to: '/settings', label: 'Settings', icon: Settings, perm: null },
];

function Sidebar({ onLogout }) {
  const { can } = useAuth();
  return (
    <aside className="sidebar">
      <Link to="/" className="brand">
        <BrandMark />
        <div className="brand-name">TTC Fleet<span>360</span></div>
        <div className="brand-sub">Logistics &amp; Fleet Management</div>
      </Link>

      <nav className="nav">
        {NAV_ITEMS.filter((item) => !item.perm || can(item.perm)).map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icon size={20} /> {label}
          </NavLink>
        ))}
      </nav>

      <div style={{ height: 18 }} />
      <div className="sidebar-promo">
        <PromoArt />
        <p>Smarter Logistics.<br />Stronger Operations.</p>
        <Link to="/company" className="btn btn-primary" style={{ width: 'fit-content', position: 'relative' }}>
          TTC Fleet360 <ArrowRight size={16} />
        </Link>
      </div>
      <button className="logout" onClick={onLogout}><LogOut size={20} /> Logout</button>
    </aside>
  );
}

/** Global search: users, branches, vehicles (debounced 300 ms). */
function GlobalSearch() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (q.trim().length < 2) { setResults(null); return undefined; }
    const timer = setTimeout(() => {
      api.get('/dashboard/search', { params: { q } }).then(({ data }) => setResults(data)).catch(() => setResults(null));
    }, 300); // wait until the user stops typing
    return () => clearTimeout(timer);
  }, [q]);

  // close the results when clicking outside
  useEffect(() => {
    const close = (e) => boxRef.current && !boxRef.current.contains(e.target) && setResults(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = (path) => { setQ(''); setResults(null); navigate(path); };
  const empty = results && !results.users.length && !results.branches.length && !results.vehicles.length;

  return (
    <div className="search-box" ref={boxRef}>
      <Search size={20} color="#334155" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users, branches, vehicles..." aria-label="Search" />
      {results && (
        <div className="search-results">
          {empty && <div className="item muted">No results for “{q}”</div>}
          {results.users.length > 0 && <h4>Users</h4>}
          {results.users.map((u) => (
            <a key={`u${u.id}`} onClick={() => go(`/users?search=${encodeURIComponent(u.email)}`)}>
              <b>{u.full_name}</b> <span className="muted small">{u.email}</span>
            </a>
          ))}
          {results.branches.length > 0 && <h4>Branches</h4>}
          {results.branches.map((b) => (
            <a key={`b${b.id}`} onClick={() => go(`/branches?search=${encodeURIComponent(b.code)}`)}>
              <b>{b.name}</b> <span className="muted small">{b.code} · {b.city}</span>
            </a>
          ))}
          {results.vehicles.length > 0 && <h4>Vehicles</h4>}
          {results.vehicles.map((v) => (
            <div className="item" key={`v${v.id}`}><Truck size={14} /> <b>{v.reg_number}</b> <span className="muted small">{v.model}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Bell icon: subscriptions expiring in the next 7 days. */
function Notifications() {
  const { can } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!can('SUBSCRIPTION_VIEW', 'DASHBOARD_VIEW')) return;
    api.get('/subscriptions/renewals/upcoming', { params: { days: 7 } }).then(({ data }) => setItems(data)).catch(() => {});
  }, [can]);

  return (
    <div style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-label="Notifications">
        <Bell size={22} fill="#0f172a" />
        {items.length > 0 && <span className="dot-badge">{items.length}</span>}
      </button>
      {open && (
        <div className="dropdown" style={{ minWidth: 290 }} onMouseLeave={() => setOpen(false)}>
          <div className="small muted" style={{ padding: '6px 12px' }}>Renewals due in 7 days</div>
          {items.length === 0 && <div style={{ padding: '6px 12px' }}>You're all caught up 🎉</div>}
          {items.map((s) => (
            <Link key={s.id} to="/subscriptions?status=EXPIRING" onClick={() => setOpen(false)}>
              <span style={{ flex: 1 }}>{s.plan_name} – {s.customer_name}</span>
              <span className="badge badge-danger">{s.days_left}d</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu({ onLogout }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <button className="user-menu" onClick={() => setOpen(!open)} onBlur={() => setTimeout(() => setOpen(false), 150)}>
      <span className="avatar">{user.full_name[0].toUpperCase()}</span>
      <b>{user.full_name.split(' ')[0]}</b>
      <ChevronDown size={16} />
      {open && (
        <div className="dropdown">
          <div style={{ padding: '8px 12px' }}>
            <b>{user.full_name}</b>
            <div className="small muted">{user.role_name}</div>
          </div>
          <Link to="/settings"><Settings size={16} /> Account settings</Link>
          <button onMouseDown={onLogout}><LogOut size={16} /> Logout</button>
        </div>
      )}
    </button>
  );
}

export default function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => { await logout(); navigate('/login'); };

  return (
    <div className="app">
      <Sidebar onLogout={handleLogout} />
      <div className="main">
        <header className="topbar">
          <GlobalSearch />
          <div className="topbar-right">
            <Notifications />
            <UserMenu onLogout={handleLogout} />
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Today's date chip (top right of the dashboard). */
export const DateChip = () => (
  <span className="date-chip"><CalendarDays size={18} /> {formatDate(new Date())} <ChevronDown size={15} /></span>
);
