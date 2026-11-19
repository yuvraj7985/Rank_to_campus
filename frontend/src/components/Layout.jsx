import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Building2,
  CalendarRange,
  Compass,
  FileCheck,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserCircle2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AiAdvisor } from '../pages/FeaturePages';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const admin = user?.role === 'admin';
  useEffect(() => {
    if (!advisorOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setAdvisorOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [advisorOpen]);
  const items = admin
    ? [
      ['/admin', 'Overview', LayoutDashboard],
      ['/admin/rounds', 'Rounds', CalendarRange],
      ['/admin/students', 'Students', GraduationCap],
      ['/admin/documents', 'Verification', FileCheck],
      ['/admin/colleges', 'Colleges', Building2],
      ['/admin/cutoffs/import', 'Historical data', Upload],
      ['/admin/allocations', 'Allocation', ShieldCheck],
      ['/notifications', 'Announcements', Bell],
      ['/admin/reports', 'Reports', BarChart3]
    ]
    : [
      ['/student', 'Dashboard', LayoutDashboard],
      ['/student/allocations', 'Allocation results', ShieldCheck],
      ['/profile', 'Profile', UserCircle2],
      ['/predictor', 'Rank Predictor', Compass],
      ['/historical-cutoffs', 'Cutoff history', BarChart3],
      ['/colleges', 'Explore Colleges', Building2],
      ['/preferences', 'Preferences', SlidersHorizontal],
      ['/documents', 'Documents', FileCheck],
      ['/notifications', 'Notifications', Bell]
    ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon"><GraduationCap /></span>
          <span>Rank<span className="accent">2</span>Campus<small>ADMISSION INTELLIGENCE</small></span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {items.map(([to, label, Icon]) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
            >
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link className="user-mini" to="/profile" aria-label="View your profile">
            <span className="avatar">{user?.name?.[0]?.toUpperCase()}</span>
            <span><b>{user?.name}</b><small>{admin ? 'Administrator' : 'Student'}</small></span>
          </Link>
          <button className="logout" type="button" onClick={() => { logout(); navigate('/login'); }}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div>
            <span className="eyebrow">ADMISSION PORTAL</span>
            <b>{admin ? 'Administration' : 'Student workspace'}</b>
          </div>
          <div className="top-user">
            <span className="status-dot" /> System online
            <Link className="profile-avatar-link" to="/profile" aria-label="Open your profile" title="Open your profile">
              <span className="avatar small">{user?.name?.[0]?.toUpperCase()}</span>
            </Link>
          </div>
        </header>
        <section className="page-content"><Outlet /></section>
      </main>
      <button
        className="ai-launcher"
        type="button"
        aria-label="Open Rank2Campus AI adviser"
        title="Ask the Rank2Campus AI adviser"
        onClick={() => setAdvisorOpen(true)}
      >
        <Sparkles size={23} />
      </button>
      {advisorOpen && (
        <div
          className="ai-widget-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setAdvisorOpen(false);
          }}
        >
          <section className="ai-widget-dialog" role="dialog" aria-modal="true" aria-label="Rank2Campus AI adviser">
            <AiAdvisor compact onClose={() => setAdvisorOpen(false)} />
          </section>
        </div>
      )}
    </div>
  );
}
