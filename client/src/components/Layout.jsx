import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, Bot, Briefcase, ClipboardList, FileText, FolderGit2, GraduationCap, LayoutDashboard, LogOut,
  Menu, MessageSquare, Mic, Moon, Search, Sun, User, Users, Presentation,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useRealtime } from '../context/RealtimeContext';
import { Avatar, Button } from './ui';
import { fullName } from '../lib/format';

export const Brand = ({ to = '/' }) => (
  <Link to={to} className="brand"><span className="brand-mark"><Presentation size={16} /></span>SkillBridge AI</Link>
);

const NAV = [
  { section: 'Overview', items: [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/profile', label: 'My profile', icon: User },
  ] },
  { section: 'Build & collaborate', items: [
    { to: '/projects', label: 'Projects', icon: FolderGit2 },
    { to: '/team-finder', label: 'Team finder', icon: Users },
    { to: '/chat', label: 'Messages', icon: MessageSquare, badge: 'messages' },
  ] },
  { section: 'Learn & teach', items: [
    { to: '/learning', label: 'Learning', icon: GraduationCap },
    { to: '/mentoring', label: 'Mentoring', icon: Presentation },
  ] },
  { section: 'Career', items: [
    { to: '/career', label: 'AI career coach', icon: Bot },
    { to: '/resume', label: 'Resume analyzer', icon: FileText },
    { to: '/interview', label: 'Interview prep', icon: Mic },
    { to: '/jobs', label: 'Jobs', icon: Briefcase },
    { to: '/applications', label: 'Applications', icon: ClipboardList },
  ] },
];

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="state" style={{ minHeight: '100vh' }}><span className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { resolved, toggle } = useTheme();
  const { unreadMessages, unreadNotifications, connected } = useRealtime();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => { setOpen(false); setMenu(false); }, [location.pathname]);

  const search = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/projects?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <Brand to="/dashboard" />
        <nav className="nav">
          {NAV.map((g) => (
            <div key={g.section}>
              <div className="nav-section">{g.section}</div>
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <it.icon size={17} /> {it.label}
                  {it.badge === 'messages' && unreadMessages > 0 && <span className="count">{unreadMessages}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer row">
          <Avatar user={user} size={32} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="truncate" style={{ fontWeight: 600 }}>{fullName(user)}</div>
            <div className="subtle row" style={{ gap: 4 }}>
              <span style={{ width: 7, height: 7, borderRadius: 9, background: connected ? 'var(--good)' : 'var(--text-3)' }} />
              {connected ? 'Online' : 'Connecting…'}
            </div>
          </div>
        </div>
      </aside>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <Button variant="ghost" icon={Menu} className="menu-btn" onClick={() => setOpen(true)} aria-label="Open menu" />
          <form className="search" onSubmit={search} role="search">
            <Search size={16} />
            <input className="input" placeholder="Search projects, skills…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
          </form>
          <div className="topbar-actions">
            <Button variant="ghost" icon={resolved === 'dark' ? Sun : Moon} onClick={toggle} aria-label="Toggle dark mode" />
            <Link to="/notifications" className="btn btn-ghost btn-icon icon-badge" aria-label={`Notifications (${unreadNotifications} unread)`}>
              <Bell size={17} />
              {unreadNotifications > 0 && <span className="dot-count">{unreadNotifications > 99 ? '99+' : unreadNotifications}</span>}
            </Link>
            <div className="dropdown">
              <button className="btn btn-ghost" style={{ padding: '0 6px' }} onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}>
                <Avatar user={user} size={28} />
              </button>
              {menu && (
                <div className="dropdown-menu" role="menu">
                  <Link to="/profile" role="menuitem"><User size={15} /> My profile</Link>
                  <Link to="/notifications" role="menuitem"><Bell size={15} /> Notifications</Link>
                  <button role="menuitem" onClick={async () => { await logout(); navigate('/'); }}><LogOut size={15} /> Log out</button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="content" id="main"><Outlet /></main>
      </div>
    </div>
  );
}
