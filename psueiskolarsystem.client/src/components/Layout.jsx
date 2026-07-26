import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import NotificationBell from './NotificationBell';
import ConfirmDialog from './ConfirmDialog';
import GlobalSearch from './GlobalSearch';
import Avatar from './Avatar';
import Logo from './Logo';
import {
  LayoutDashboard, GraduationCap, FileCheck, Users, Bell,
  FolderOpen, User, LogOut, BarChart2,
  ChevronLeft, Settings, Menu, X, ClipboardList, Activity, Award, CalendarClock, MessageSquare,
  Sun, Moon, Monitor, HelpCircle, UserCheck, Banknote, ShieldCheck,
} from 'lucide-react';
import { getPendingApprovalCount } from '../api/scholarApprovals';

/* ── Responsive hook ─────────────────────────────── */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = e => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);
  return matches;
}

/* ── Nav config ──────────────────────────────────── */
const navByRole = {
  Administrator: [
    { to: '/dashboard',       label: 'Dashboard',       Icon: LayoutDashboard },
    { section: 'Manage' },
    { to: '/scholars',        label: 'Scholars',         Icon: GraduationCap },
    { to: '/scholar-approvals', label: 'Scholar Approvals', Icon: UserCheck, badge: 'approvals' },
    { to: '/document-review', label: 'Document Review',  Icon: FileCheck },
    { to: '/deadlines',       label: 'Deadlines',        Icon: CalendarClock },
    { to: '/scholarship-types', label: 'Scholarship Types', Icon: Award },
    { to: '/one-time-grants', label: 'One-Time Grants',  Icon: Banknote },
    { to: '/scholarship-verification', label: 'Scholarship Check', Icon: ShieldCheck },
    { to: '/requirements',    label: 'Requirements',     Icon: ClipboardList },
    { to: '/users',           label: 'Users',            Icon: Users },
    { section: 'Engage' },
    { to: '/announcements',   label: 'Announcements',    Icon: Bell },
    { to: '/messages',        label: 'Messages',         Icon: MessageSquare },
    { to: '/analytics',       label: 'Data Visualization', Icon: BarChart2 },
    { section: 'System' },
    { to: '/settings',      label: 'Settings',      Icon: Settings  },
    { to: '/activity-log',  label: 'Activity Log',  Icon: Activity  },
    { to: '/help',          label: 'Help & FAQ',    Icon: HelpCircle },
  ],
  ScholarshipCoordinator: [
    { to: '/dashboard',       label: 'Dashboard',       Icon: LayoutDashboard },
    { section: 'Manage' },
    { to: '/scholars',        label: 'Scholars',         Icon: GraduationCap },
    { to: '/scholar-approvals', label: 'Scholar Approvals', Icon: UserCheck, badge: 'approvals' },
    { to: '/document-review', label: 'Document Review',  Icon: FileCheck },
    { to: '/deadlines',       label: 'Deadlines',        Icon: CalendarClock },
    { to: '/one-time-grants', label: 'One-Time Grants',  Icon: Banknote },
    { to: '/scholarship-verification', label: 'Scholarship Check', Icon: ShieldCheck },
    { section: 'Engage' },
    { to: '/announcements',   label: 'Announcements',    Icon: Bell },
    { to: '/messages',        label: 'Messages',         Icon: MessageSquare },
    { to: '/analytics',       label: 'Data Visualization', Icon: BarChart2 },
    { section: 'System' },
    { to: '/help',            label: 'Help & FAQ',       Icon: HelpCircle },
  ],
  Scholar: [
    { to: '/dashboard',    label: 'Dashboard',    Icon: LayoutDashboard },
    { section: 'My Account' },
    { to: '/my-documents', label: 'My Documents', Icon: FolderOpen },
    { to: '/messages',     label: 'Messages',     Icon: MessageSquare },
    { to: '/my-profile',   label: 'My Profile',   Icon: User },
    { to: '/help',         label: 'Help & FAQ',   Icon: HelpCircle },
  ],
};

const EXPANDED_W = 260;
const COLLAPSED_W = 68;

/* ── Shared sidebar styles ───────────────────────── */
const SIDEBAR_BG = {
  background: 'linear-gradient(160deg, #001d6e 0%, #00103d 60%, #000820 100%)',
  boxShadow: '8px 0 32px rgba(0,8,32,0.45), inset -1px 0 0 rgba(255,255,255,0.06)',
};

/* ── IconBtn: small ghost icon button ────────────── */
function IconBtn({ onClick, title, children, danger }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 10, border: 'none', cursor: 'pointer',
        background: 'rgba(255,255,255,0.07)',
        color: danger ? 'rgba(255,160,160,0.7)' : 'rgba(255,255,255,0.5)',
        transition: 'all 0.15s ease',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = danger ? 'rgba(255,60,60,0.15)' : 'rgba(255,255,255,0.14)';
        e.currentTarget.style.color = danger ? '#ff8888' : '#fff';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
        e.currentTarget.style.color = danger ? 'rgba(255,160,160,0.7)' : 'rgba(255,255,255,0.5)';
      }}
    >
      {children}
    </button>
  );
}

export default function Layout({ children }) {
  const { user, token, signOut } = useAuth();
  const { messageUnread } = useNotifications();
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const { theme, setTheme } = useTheme();
  const navigate   = useNavigate();

  function cycleTheme() {
    const order = ['light', 'dark', 'system'];
    setTheme(order[(order.indexOf(theme) + 1) % order.length]);
  }
  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
  const location   = useLocation();
  const isDesktop  = useMediaQuery('(min-width: 1024px)');

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar-collapsed') === 'true'
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  /* Persist desktop collapsed state */
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
  }, [collapsed]);

  /* Auto-close mobile drawer on route change */
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  /* Pending scholar registrations, for the sidebar badge. Re-read on navigation so
     approving one from the queue clears the badge without a reload. */
  useEffect(() => {
    if (user?.role !== 'Administrator' && user?.role !== 'ScholarshipCoordinator') return;
    let cancelled = false;
    getPendingApprovalCount(token)
      .then(c => { if (!cancelled) setPendingApprovals(c); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.role, token, location.pathname]);

  /* Auto-close drawer when viewport becomes desktop */
  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  function handleSignOut() {
    setConfirmLogout(true);
  }

  function confirmSignOut() {
    setConfirmLogout(false);
    signOut();
    navigate('/login', { replace: true });
  }

  const navItems  = navByRole[user?.role] ?? [];
  const roleLabel = user?.role === 'ScholarshipCoordinator' ? 'Coordinator' : user?.role;
  const isCollapsed = isDesktop && collapsed;

  /* ── Sidebar inner content ──────────────────────── */
  const SidebarContent = (
    <div style={{
      ...SIDEBAR_BG,
      width: isDesktop ? (collapsed ? COLLAPSED_W : EXPANDED_W) : EXPANDED_W,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      position: 'relative',
    }}>

      {/* Ambient glows */}
      <div style={{
        position: 'absolute', top: -80, left: -60, width: 240, height: 240,
        borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(0,60,200,0.25) 0%, transparent 70%)',
      }} />
      <div style={{
        position: 'absolute', bottom: 60, right: -80, width: 200, height: 200,
        borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(245,184,0,0.09) 0%, transparent 70%)',
      }} />

      {/* ── HEADER ── */}
      <div style={{
        padding: isCollapsed ? '20px 13px' : '22px 18px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        transition: 'padding 0.25s',
        minHeight: 74,
      }}>
        {/* Logo — when collapsed on desktop, acts as the expand button */}
        <div
          onClick={isCollapsed && isDesktop ? () => setCollapsed(false) : undefined}
          title={isCollapsed && isDesktop ? 'Expand sidebar' : undefined}
          style={{
            display: 'flex', alignItems: 'center', gap: 11, overflow: 'hidden', minWidth: 0,
            cursor: isCollapsed && isDesktop ? 'pointer' : 'default',
          }}
        >
          <Logo size={42} shadow="0 4px 0 rgba(0,0,0,0.28)" style={{ transition: 'box-shadow 0.15s' }} />

          {/* Text — hidden when collapsed */}
          <div style={{
            overflow: 'hidden', whiteSpace: 'nowrap',
            maxWidth: isCollapsed ? 0 : 180,
            opacity: isCollapsed ? 0 : 1,
            transition: 'max-width 0.22s ease, opacity 0.18s ease',
          }}>
            <p style={{ fontWeight: 900, fontSize: 15, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.2 }}>
              e-Iskolar
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', fontWeight: 500, marginTop: 2 }}>
              PSU Lingayen Campus
            </p>
          </div>
        </div>

        {/* Desktop collapse button — only visible when expanded */}
        {isDesktop && !isCollapsed && (
          <button
            onClick={() => setCollapsed(true)}
            title="Collapse sidebar"
            style={{
              width: 26, height: 26, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s',
              marginLeft: 8,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          >
            <ChevronLeft size={13} strokeWidth={2.5} color="rgba(255,255,255,0.75)" />
          </button>
        )}

        {/* Mobile close button */}
        {!isDesktop && (
          <button
            onClick={() => setMobileOpen(false)}
            style={{
              width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0,
            }}
          >
            <X size={14} strokeWidth={2.5} color="rgba(255,255,255,0.75)" />
          </button>
        )}
      </div>

      {/* System status pill — hidden when collapsed */}
      {!isCollapsed && (
        <div style={{ padding: '12px 18px 0', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 999,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
              Scholar Management System
            </span>
          </div>
        </div>
      )}

      {/* ── NAV ── */}
      <nav style={{
        flex: 1,
        padding: isCollapsed ? '12px 8px' : '12px 10px',
        overflowY: 'auto', overflowX: 'hidden',
        position: 'relative', zIndex: 1,
        transition: 'padding 0.25s',
      }}>
        {navItems.map((item, idx) => {
          /* Section labels — hidden when collapsed */
          if (item.section) {
            if (isCollapsed) {
              return <div key={`sep-${idx}`} style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '12px 4px' }} />;
            }
            return (
              <p key={`sec-${idx}`} style={{
                fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'rgba(255,255,255,0.22)',
                padding: '16px 10px 6px', whiteSpace: 'nowrap',
              }}>
                {item.section}
              </p>
            );
          }

          const { to, label, Icon, badge } = item;
          const count = to === '/messages' ? messageUnread
                      : badge === 'approvals' ? pendingApprovals
                      : 0;
          return (
            <NavLink key={to} to={to} data-tour={to} style={{ display: 'block', marginBottom: 2 }} title={isCollapsed ? label : undefined}>
              {({ isActive }) => (
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    gap: isCollapsed ? 0 : 10,
                    padding: isCollapsed ? '8px' : '8px 12px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    border: '1px solid transparent',
                    transition: 'background 0.14s, border-color 0.14s, box-shadow 0.14s',
                    /* Selected state: a gold wash that fades out to the right, a hairline
                       edge, and the rail marker below — instead of a flat grey block. */
                    ...(isActive ? {
                      background: 'linear-gradient(95deg, rgba(255,210,63,0.17) 0%, rgba(255,210,63,0.055) 48%, rgba(255,255,255,0.02) 100%)',
                      borderColor: 'rgba(255,210,63,0.26)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                    } : {}),
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.055)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* Rail marker — sits flush against the sidebar's left edge (nav has 10px
                      of horizontal padding), so the eye can track the selection down the rail. */}
                  {isActive && !isCollapsed && (
                    <span style={{
                      position: 'absolute', left: -11, top: '50%', transform: 'translateY(-50%)',
                      width: 3, height: 20, borderRadius: 999,
                      background: 'linear-gradient(180deg, #ffd23f, #d99700)',
                      boxShadow: '0 0 10px rgba(255,210,63,0.5)',
                    }} />
                  )}

                  {/* Icon box — inverted to solid gold when active, matching the PSU mark */}
                  <div style={{
                    width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive
                      ? 'linear-gradient(145deg, #ffd23f, #e0a000)'
                      : 'rgba(255,255,255,0.06)',
                    boxShadow: isActive ? '0 2px 7px rgba(224,160,0,0.32)' : 'none',
                    transition: 'background 0.14s, box-shadow 0.14s',
                  }}>
                    <Icon size={14} strokeWidth={2.4} color={isActive ? '#1a0e00' : 'rgba(255,255,255,0.58)'} />
                  </div>

                  {/* Label */}
                  <span style={{
                    flex: 1, fontSize: 13, fontWeight: isActive ? 700 : 500,
                    color: isActive ? '#ffffff' : 'rgba(255,255,255,0.6)',
                    letterSpacing: isActive ? '-0.01em' : 0,
                    whiteSpace: 'nowrap', overflow: 'hidden',
                    maxWidth: isCollapsed ? 0 : 160,
                    opacity: isCollapsed ? 0 : 1,
                    transition: 'max-width 0.22s ease, opacity 0.15s ease',
                  }}>
                    {label}
                  </span>

                  {/* Count badge — unread messages, or scholars waiting for approval */}
                  {count > 0 && !isCollapsed && (
                    <span style={{
                      minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
                      background: badge === 'approvals' ? '#c07800' : '#d92020',
                      color: '#fff', fontSize: 10, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}

                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── USER SECTION ── */}
      <div style={{
        padding: isCollapsed ? '10px 8px 14px' : '10px 12px 16px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        position: 'relative', zIndex: 1,
        transition: 'padding 0.25s',
      }}>
        {isCollapsed ? (
          /* Collapsed: icon column */
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <Avatar
              userId={user?.id}
              name={user?.fullName}
              hasAvatar={user?.hasAvatar}
              size={36}
              radius={11}
              style={{ boxShadow: '0 3px 0 rgba(0,0,0,0.22)' }}
            />
            <IconBtn onClick={() => navigate('/profile')} title="My Profile">
              <Settings size={13} strokeWidth={2.5} />
            </IconBtn>
            <IconBtn onClick={handleSignOut} title="Sign out" danger>
              <LogOut size={13} strokeWidth={2.5} />
            </IconBtn>
          </div>
        ) : (
          /* Expanded: full card */
          <div style={{
            borderRadius: 16, background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)', padding: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
              <Avatar
                userId={user?.id}
                name={user?.fullName}
                hasAvatar={user?.hasAvatar}
                size={36}
                radius={11}
                style={{ boxShadow: '0 3px 0 rgba(0,0,0,0.22)' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 12.5, fontWeight: 700, color: '#fff',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.3,
                }}>
                  {user?.fullName}
                </p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginTop: 2, fontWeight: 500 }}>
                  {roleLabel}
                </p>
              </div>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', marginBottom: 8 }} />

            <div style={{ display: 'flex', gap: 5 }}>
              <button
                onClick={() => navigate('/profile')}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '6px 8px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.55)',
                  fontSize: 11, fontWeight: 600, transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.13)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
              >
                <Settings size={11} strokeWidth={2.5} /> Profile
              </button>
              <button
                onClick={handleSignOut}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '6px 8px', borderRadius: 9, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: 'rgba(255,255,255,0.38)',
                  fontSize: 11, fontWeight: 600, transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ff8888'; e.currentTarget.style.background = 'rgba(255,60,60,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.38)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <LogOut size={11} strokeWidth={2.5} /> Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /* ── Shell ──────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── Mobile backdrop ── */}
      {!isDesktop && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 40,
            background: 'rgba(0,8,32,0.55)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
          }}
        />
      )}

      {/* ── Desktop sidebar (static) ── */}
      {isDesktop && (
        <aside style={{
          height: '100vh', position: 'sticky', top: 0, flexShrink: 0,
          width: collapsed ? COLLAPSED_W : EXPANDED_W,
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}>
          {SidebarContent}
        </aside>
      )}

      {/* ── Mobile drawer (fixed overlay) ── */}
      {!isDesktop && (
        <div style={{
          position: 'fixed', top: 0, left: 0, height: '100dvh', zIndex: 50,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          width: EXPANDED_W,
        }}>
          {SidebarContent}
        </div>
      )}

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>

        {/* ── Top navbar (all screens) ── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 30,
          background: 'var(--bg)',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0,48,135,0.08)',
          minHeight: 58,
        }}>
          {/* The bar spans the viewport so its rule and blur are edge-to-edge, but its
              controls sit inside the same shell the page content uses — so the search
              lines up with the page title and the avatar with the page's right edge. */}
          <div className="page-shell" style={{ padding: '9px 32px', display: 'flex', alignItems: 'center', gap: 12, minHeight: 58 }}>
          {/* Mobile: hamburger + brand */}
          {!isDesktop && (
            <>
              <button
                onClick={() => setMobileOpen(true)}
                style={{
                  width: 38, height: 38, borderRadius: 12, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg)',
                  boxShadow: '4px 4px 10px rgba(163,177,198,0.55), -3px -3px 8px rgba(255,255,255,0.9)',
                }}
              >
                <Menu size={17} strokeWidth={2.5} color="#003087" />
              </button>
              <div style={{
                width: 30, height: 30, borderRadius: 9,
                background: 'linear-gradient(145deg, #ffd030, #e0a000)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 900, color: '#1a0e00',
              }}>PSU</div>
            </>
          )}

          {/* Global search — coordinators/admins search scholars, announcements, requirements */}
          {(user?.role === 'Administrator' || user?.role === 'ScholarshipCoordinator') && (
            <GlobalSearch isDesktop={isDesktop} />
          )}

          {/* Right cluster */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={cycleTheme}
              title={`Theme: ${theme} (click to change)`}
              style={{
                width: 40, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--bg)',
                boxShadow: '4px 4px 10px rgba(163,177,198,0.55), -3px -3px 8px rgba(255,255,255,0.9)',
              }}
            >
              <ThemeIcon size={17} strokeWidth={2.2} color="#003087" />
            </button>
            <span data-tour="notifications"><NotificationBell variant="inline" /></span>
            <Avatar
              userId={user?.id}
              name={user?.fullName}
              hasAvatar={user?.hasAvatar}
              size={36}
              radius={11}
              title="My Profile"
              onClick={() => navigate('/profile')}
              style={{ boxShadow: '3px 3px 8px rgba(163,177,198,0.5), -2px -2px 5px rgba(255,255,255,0.85)' }}
            />
          </div>
          </div>
        </header>

        {/* Fade the routed content in on each navigation */}
        <div key={location.pathname} className="route-fade">
          {children}
        </div>
      </main>

      <ConfirmDialog
        open={confirmLogout}
        title="Sign out?"
        message="You’ll be returned to the login page and will need to sign in again to continue."
        confirmLabel="Sign out"
        cancelLabel="Stay signed in"
        danger
        onConfirm={confirmSignOut}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}
