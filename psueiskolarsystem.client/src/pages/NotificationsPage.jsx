import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { getNotifications, markRead, markUnread, markAllRead, deleteNotification } from '../api/notifications';
import { useTitle } from '../hooks/useTitle';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_FILTER_CATEGORIES } from '../constants/notifications';
import { Bell, FileCheck, Megaphone, Clock, MessageSquare, UserCog, CheckCheck, Undo2, Trash2 } from 'lucide-react';

const C = NOTIFICATION_CATEGORIES;
const CATEGORY_META = {
  [C.DocumentStatus]: { Icon: FileCheck, color: '#0369a1', bg: 'rgba(3,105,161,0.1)', label: 'Document' },
  [C.Announcement]:   { Icon: Megaphone, color: '#b45309', bg: 'rgba(245,184,0,0.14)', label: 'Announcement' },
  [C.Deadline]:       { Icon: Clock,     color: '#c2410c', bg: 'rgba(234,88,12,0.12)', label: 'Deadline' },
  [C.Message]:        { Icon: MessageSquare, color: '#4338ca', bg: 'rgba(67,56,202,0.1)', label: 'Message' },
  [C.Account]:        { Icon: UserCog,   color: '#334155', bg: 'rgba(51,65,85,0.1)', label: 'Account' },
};
const DEFAULT_META = { Icon: Bell, color: '#003087', bg: 'rgba(0,48,135,0.08)', label: 'General' };
const FILTERS = ['', ...NOTIFICATION_FILTER_CATEGORIES];

function timeAgo(iso) {
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'just now';
  const m = Math.floor(secs / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function NotificationsPage() {
  useTitle('Notifications');
  const { token } = useAuth();
  const { refresh } = useNotifications();
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [paging, setPaging] = useState({ page: 1, totalPages: 1, total: 0 });
  const [category, setCategory] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const data = await getNotifications(token, { category, unreadOnly, page, pageSize: 25 });
      setItems(data.items);
      setPaging({ page: data.page, totalPages: data.totalPages, total: data.total });
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token, category, unreadOnly]);

  useEffect(() => { load(1); }, [load]);

  async function handleClick(n) {
    if (!n.isRead) {
      try { await markRead(n.id, token); } catch { /* best effort */ }
      setItems(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x));
      refresh();
    }
    if (n.linkUrl) navigate(n.linkUrl);
  }

  async function handleMarkAll() {
    try { await markAllRead(token); } catch { /* best effort */ }
    setItems(prev => prev.map(x => ({ ...x, isRead: true })));
    refresh();
  }

  async function handleMarkUnread(n) {
    try { await markUnread(n.id, token); } catch { /* best effort */ }
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, isRead: false } : x));
    refresh();
  }

  async function handleDelete(n) {
    try { await deleteNotification(n.id, token); } catch { /* best effort */ }
    setItems(prev => prev.filter(x => x.id !== n.id));
    refresh();
  }

  return (
    <Layout>
      <div className="p-4 sm:p-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="page-title">Notifications</h1>
            <p className="page-subtitle">{paging.total} total</p>
            <span className="page-title-bar" />
          </div>
          <button onClick={handleMarkAll} className="clay-btn clay-btn-ghost px-4 py-2 text-sm flex items-center gap-2">
            <CheckCheck size={15} strokeWidth={2.4} /> Mark all read
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-5 items-center">
          {FILTERS.map(f => (
            <button
              key={f || 'all'}
              onClick={() => setCategory(f)}
              className="clay-btn px-3 py-1.5 text-xs font-semibold"
              style={category === f
                ? { background: 'rgba(0,37,112,0.10)', color: '#002570', border: '1.5px solid rgba(0,37,112,0.25)' }
                : { color: 'var(--text)' }}
            >
              {f ? (CATEGORY_META[f]?.label ?? f) : 'All'}
            </button>
          ))}
          <label className="flex items-center gap-1.5 text-xs font-semibold ml-2 cursor-pointer" style={{ color: 'var(--text)' }}>
            <input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} style={{ accentColor: '#003087' }} />
            Unread only
          </label>
        </div>

        <div className="clay-card overflow-hidden">
          {loading ? (
            <p className="text-center py-12 text-sm" style={{ color: '#7a8aaa' }}>Loading…</p>
          ) : items.length === 0 ? (
            <div className="text-center py-14">
              <Bell size={28} strokeWidth={1.5} color="rgba(0,48,135,0.25)" />
              <p className="mt-2 text-sm" style={{ color: '#7a8aaa' }}>No notifications.</p>
            </div>
          ) : items.map(n => {
            const meta = CATEGORY_META[n.category] ?? DEFAULT_META;
            const { Icon } = meta;
            return (
              <div key={n.id} role="button" tabIndex={0}
                onClick={() => handleClick(n)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(n); } }}
                className="group w-full text-left flex items-start gap-3 px-5 py-4 cursor-pointer"
                style={{ borderBottom: '1px solid rgba(0,48,135,0.05)', background: n.isRead ? 'transparent' : 'rgba(0,48,135,0.035)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: meta.bg }}>
                  <Icon size={17} strokeWidth={2.2} color={meta.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm truncate" style={{ color: 'var(--text-strong)', fontWeight: n.isRead ? 600 : 800 }}>{n.title}</p>
                    {!n.isRead && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#d92020' }} />}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: '#5a6a85' }}>{n.message}</p>
                  <p className="text-xs mt-1" style={{ color: '#9aa6bc', fontWeight: 600 }}>{timeAgo(n.createdAt)}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  {n.isRead && (
                    <button
                      onClick={e => { e.stopPropagation(); handleMarkUnread(n); }}
                      title="Mark as unread"
                      className="p-1.5 rounded-lg hover:bg-black/5"
                      style={{ color: '#7a8aaa' }}>
                      <Undo2 size={15} strokeWidth={2.2} />
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(n); }}
                    title="Delete notification"
                    className="p-1.5 rounded-lg hover:bg-black/5"
                    style={{ color: '#c04040' }}>
                    <Trash2 size={15} strokeWidth={2.2} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {!loading && paging.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs" style={{ color: '#7a8aaa' }}>Page {paging.page} of {paging.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => load(paging.page - 1)} disabled={paging.page <= 1}
                className="clay-btn clay-btn-ghost text-xs px-4" style={{ minHeight: 34, opacity: paging.page <= 1 ? 0.4 : 1 }}>Previous</button>
              <button onClick={() => load(paging.page + 1)} disabled={paging.page >= paging.totalPages}
                className="clay-btn clay-btn-ghost text-xs px-4" style={{ minHeight: 34, opacity: paging.page >= paging.totalPages ? 0.4 : 1 }}>Next</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
