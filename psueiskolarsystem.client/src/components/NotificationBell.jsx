import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, FileCheck, Megaphone, Clock, MessageSquare, UserCog, CheckCheck } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

/* Relative "time ago" from a UTC timestamp */
function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const CATEGORY_META = {
  DocumentStatus: { Icon: FileCheck, color: '#0369a1', bg: 'rgba(3,105,161,0.1)' },
  Announcement:   { Icon: Megaphone, color: '#b45309', bg: 'rgba(245,184,0,0.14)' },
  Deadline:       { Icon: Clock,     color: '#c2410c', bg: 'rgba(234,88,12,0.12)' },
  Message:        { Icon: MessageSquare, color: '#4338ca', bg: 'rgba(67,56,202,0.1)' },
  Account:        { Icon: UserCog,   color: '#334155', bg: 'rgba(51,65,85,0.1)' },
};
const DEFAULT_META = { Icon: Bell, color: '#003087', bg: 'rgba(0,48,135,0.08)' };

export default function NotificationBell({ variant = 'floating' }) {
  const { items, unreadCount, markOneRead, markEverythingRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  function handleItemClick(n) {
    if (!n.isRead) markOneRead(n.id);
    setOpen(false);
    if (n.linkUrl) navigate(n.linkUrl);
  }

  const wrapperStyle = variant === 'floating'
    ? { position: 'fixed', top: 18, right: 24, zIndex: 35 }
    : { position: 'relative' };

  return (
    <div ref={rootRef} style={wrapperStyle}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Notifications"
        style={{
          position: 'relative', width: 40, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--bg)',
          boxShadow: open
            ? 'inset 3px 3px 7px rgba(163,177,198,0.6), inset -3px -3px 7px rgba(255,255,255,0.9)'
            : '4px 4px 10px rgba(163,177,198,0.55), -3px -3px 8px rgba(255,255,255,0.9)',
          transition: 'box-shadow 0.15s',
        }}
      >
        <Bell size={18} strokeWidth={2.3} color="#003087" />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, padding: '0 4px',
            borderRadius: 999, background: 'linear-gradient(145deg, #ff5a5a, #d92020)',
            color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: '18px', textAlign: 'center',
            boxShadow: '0 2px 5px rgba(217,32,32,0.5)', border: '2px solid #e8edf5',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 48, right: 0, width: 360, maxWidth: 'calc(100vw - 32px)',
          background: '#fff', borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,20,60,0.22), 0 2px 8px rgba(0,20,60,0.1)',
          border: '1px solid rgba(0,48,135,0.08)', zIndex: 50,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '13px 16px', borderBottom: '1px solid rgba(0,48,135,0.07)',
          }}>
            <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text-strong)' }}>
              Notifications {unreadCount > 0 && (
                <span style={{ color: '#d92020', fontSize: 12, fontWeight: 700 }}>· {unreadCount} new</span>
              )}
            </p>
            {unreadCount > 0 && (
              <button
                onClick={markEverythingRead}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, border: 'none', cursor: 'pointer',
                  background: 'transparent', color: '#003087', fontSize: 11.5, fontWeight: 700, padding: 4,
                }}
              >
                <CheckCheck size={13} strokeWidth={2.5} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {items.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                <Bell size={26} strokeWidth={1.6} color="rgba(0,48,135,0.25)" />
                <p style={{ marginTop: 8, fontSize: 12.5, color: '#7a869c', fontWeight: 500 }}>
                  You're all caught up.
                </p>
              </div>
            ) : items.map(n => {
              const meta = CATEGORY_META[n.category] ?? DEFAULT_META;
              const { Icon } = meta;
              return (
                <button
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  style={{
                    width: '100%', textAlign: 'left', display: 'flex', gap: 11, alignItems: 'flex-start',
                    padding: '12px 16px', border: 'none', cursor: 'pointer',
                    borderBottom: '1px solid rgba(0,48,135,0.05)',
                    background: n.isRead ? 'transparent' : 'rgba(0,48,135,0.035)',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,48,135,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = n.isRead ? 'transparent' : 'rgba(0,48,135,0.035)'}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, flexShrink: 0, marginTop: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', background: meta.bg,
                  }}>
                    <Icon size={16} strokeWidth={2.2} color={meta.color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <p style={{
                        flex: 1, fontSize: 13, fontWeight: n.isRead ? 600 : 800, color: 'var(--text-strong)',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d92020', flexShrink: 0 }} />
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: '#5a6a85', lineHeight: 1.4, marginTop: 2 }}>
                      {n.message}
                    </p>
                    <p style={{ fontSize: 10.5, color: '#9aa6bc', fontWeight: 600, marginTop: 4 }}>
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <button
            onClick={() => { setOpen(false); navigate('/notifications'); }}
            style={{
              width: '100%', padding: '11px 16px', border: 'none', cursor: 'pointer',
              borderTop: '1px solid rgba(0,48,135,0.07)', background: '#fafbfe',
              color: '#003087', fontSize: 12.5, fontWeight: 700,
            }}
          >
            See all notifications
          </button>
        </div>
      )}
    </div>
  );
}
